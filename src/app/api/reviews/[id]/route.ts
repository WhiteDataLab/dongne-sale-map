import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { deletePublicImages, isPublicStorageUrl } from "@/lib/supabaseStorage";

/** 리뷰 수정/삭제 (작성자 본인 또는 관리자). */
export const runtime = "nodejs";

type PatchBody = { rating?: number; content?: string; photoUrls?: unknown };

/**
 * 리뷰 수정 (작성자 본인 또는 관리자).
 * 별점·내용·사진을 갱신한다. 포인트 정책은 작성 시점 기준이라 수정으로는 추가 적립/회수하지 않는다.
 * 사진 교체·삭제로 더 이상 쓰이지 않는 이전 이미지는 스토리지에서 정리한다.
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

  const { rating, content } = body;
  if (!content?.trim()) {
    return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: "리뷰가 너무 길어요. (최대 1000자)" }, { status: 400 });
  }
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "평점은 1~5 사이여야 해요." }, { status: 400 });
  }
  // 사진은 우리 공개 스토리지 URL만 인정(위조 URL 차단)
  const photoUrls = Array.isArray(body.photoUrls)
    ? body.photoUrls.filter((u): u is string => typeof u === "string" && isPublicStorageUrl(u)).slice(0, 5)
    : [];

  try {
    const review = await prisma.review.findUnique({
      where: { id },
      select: { userId: true, photoUrls: true },
    });
    if (!review) return NextResponse.json({ error: "리뷰를 찾을 수 없어요." }, { status: 404 });
    if (review.userId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "수정할 권한이 없어요." }, { status: 403 });
    }

    await prisma.review.update({
      where: { id },
      data: { rating, content: content.trim(), photoUrls },
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
