import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { deletePublicImages, isPublicStorageUrl, isReceiptPath } from "@/lib/supabaseStorage";

/** 리뷰 수정/삭제 (작성자 본인 또는 관리자). */
export const runtime = "nodejs";

type PatchBody = {
  rating?: number;
  content?: string;
  tags?: unknown;
  productIds?: unknown;
  photoUrls?: unknown;
  receiptPath?: unknown;
};

/** 문자열 배열만 추출 + 트림 + 빈값/중복 제거 + 개수 제한. */
function cleanStrings(value: unknown, max: number, maxLen = 100): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t) out.push(t.slice(0, maxLen));
    if (out.length >= max) break;
  }
  return Array.from(new Set(out));
}

/**
 * 리뷰 수정 (작성자 본인 또는 관리자).
 * 별점·내용·태그·구매메뉴·사진을 갱신한다. 포인트/별점 반영(scored)은 작성 시점 기준이라
 * 수정으로는 바뀌지 않는다. 사진 교체·삭제로 더 이상 쓰이지 않는 이미지는 스토리지에서 정리한다.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const { rating } = body;
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const tags = cleanStrings(body.tags, 12, 50);
  const productIds = cleanStrings(body.productIds, 30);
  // 사진은 우리 공개 스토리지 URL만 인정(위조 URL 차단)
  const photoUrls = Array.isArray(body.photoUrls)
    ? body.photoUrls.filter((u): u is string => typeof u === "string" && isPublicStorageUrl(u)).slice(0, 5)
    : [];

  if (productIds.length === 0) {
    return NextResponse.json({ error: "구매하신 메뉴를 1개 이상 선택해 주세요." }, { status: 400 });
  }
  if (tags.length === 0 && !content) {
    return NextResponse.json({ error: "태그를 고르거나 직접 입력해 주세요." }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: "리뷰가 너무 길어요. (최대 1000자)" }, { status: 400 });
  }
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "평점은 1~5 사이여야 해요." }, { status: 400 });
  }

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, storeId: true, photoUrls: true },
    });
    if (!review) return NextResponse.json({ error: "리뷰를 찾을 수 없어요." }, { status: 404 });
    if (review.userId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "수정할 권한이 없어요." }, { status: 403 });
    }

    // 선택한 메뉴가 실제 이 가게의 상품인지 검증
    const valid = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId: review.storeId, hidden: false },
      select: { id: true },
    });
    if (valid.length === 0) {
      return NextResponse.json({ error: "선택한 메뉴를 찾을 수 없어요." }, { status: 400 });
    }

    // 새 영수증 경로가 오면 갱신, 없으면 기존 유지(제거는 미지원)
    const receiptUrl =
      typeof body.receiptPath === "string" && isReceiptPath(body.receiptPath) ? body.receiptPath : undefined;

    await prisma.review.update({
      where: { id },
      data: {
        rating,
        content,
        tags,
        productIds: valid.map((p) => p.id),
        photoUrls,
        ...(receiptUrl ? { receiptUrl } : {}),
      },
    });

    // 교체/삭제로 더 이상 참조되지 않는 이전 사진 정리(best-effort)
    const removed = review.photoUrls.filter((u) => !photoUrls.includes(u));
    if (removed.length) await deletePublicImages(removed);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "수정에 실패했어요." }, { status: 500 });
  }
}

/** 리뷰 삭제 (작성자 본인 또는 관리자). 적립 포인트 회수 + 사진 정리. */

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    const review = await prisma.review.findUnique({ where: { id }, select: { userId: true, photoUrls: true } });
    if (!review) return NextResponse.json({ error: "리뷰를 찾을 수 없어요." }, { status: 404 });
    if (review.userId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "삭제할 권한이 없어요." }, { status: 403 });
    }
    await prisma.$transaction([
      prisma.pointLog.deleteMany({ where: { refType: "review", refId: id } }),
      prisma.review.delete({ where: { id } }),
    ]);
    await deletePublicImages(review.photoUrls);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
  }
}
