import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { isPublicStorageUrl, isReceiptPath } from "@/lib/supabaseStorage";
import { kstTodayStart } from "@/lib/businessHours";
import { getPointConfig, reviewGrant } from "@/lib/pointConfig";
import { getSiteSettings } from "@/lib/siteSettings";
import { screenReview } from "@/lib/moderation";

/**
 * 리뷰 작성 (스펙 Phase 3 + 리뷰 규칙 개편).
 * 규칙:
 *  - 모든 리뷰는 구매 메뉴(상품) 1개 이상 연결 필수(다중 선택 가능).
 *  - **최초 리뷰**(계정 첫 리뷰): 영수증 없이 가능. 글만=base(기본 10) / 사진 동반=2×base(20).
 *  - **두번째 리뷰부터**: 해당 가게 구매 **영수증 필수**(없으면 작성 불가). 글=2×base(20) / 사진=4×base(40).
 *  - 같은 날 같은 가게에 이미 (반영된)리뷰가 있으면 재작성은 가능하나 포인트·별점 미반영(scored=false).
 *  - **자동 모더레이션**: 욕설·음란·광고 감지 시 삭제 대신 임시 보관(held) → 비공개 보류 + 관리자 검토.
 * 어뷰징 방어: 레이트리밋, 사진/메뉴는 우리 데이터만 인정.
 */
export const runtime = "nodejs";

const RATE_WINDOW_MS = 60_000;
const MAX_TAGS = 12;

type Body = {
  storeId?: string;
  rating?: number;
  content?: string;
  tags?: unknown;
  productIds?: unknown;
  photoUrls?: unknown;
  receiptPath?: unknown;
};

/** 문자열 배열만 추출 + 트림 + 빈값 제거 + 개수 제한. */
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

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const { storeId, rating } = body;
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const tags = cleanStrings(body.tags, MAX_TAGS, 50);
  const productIds = cleanStrings(body.productIds, 30);
  // 사진은 우리 공개 스토리지에서 올린 URL만 인정(가짜 URL로 포인트 우회 차단)
  const photoUrls = Array.isArray(body.photoUrls)
    ? body.photoUrls.filter((u): u is string => typeof u === "string" && isPublicStorageUrl(u)).slice(0, 5)
    : [];
  // 영수증 인증(선택): 비공개 경로 형식만 인정
  const receiptUrl =
    typeof body.receiptPath === "string" && isReceiptPath(body.receiptPath) ? body.receiptPath : null;

  if (!storeId) {
    return NextResponse.json({ error: "가게 정보가 없어요." }, { status: 400 });
  }
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
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }

    // 선택한 메뉴가 실제 이 가게의 상품인지 검증(위조 차단)
    const valid = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId, hidden: false },
      select: { id: true },
    });
    if (valid.length === 0) {
      return NextResponse.json({ error: "선택한 메뉴를 찾을 수 없어요." }, { status: 400 });
    }
    const linkedIds = valid.map((p) => p.id);

    // 어뷰징 방어) 단시간 다중 작성 레이트리밋
    const recent = await prisma.review.count({
      where: { userId, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
    });
    if (recent >= (await getSiteSettings()).rateReview) {
      return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    // 최초/재방문 판정(계정 기준). 두번째 리뷰부터는 구매 영수증 인증 필수.
    const priorCount = await prisma.review.count({ where: { userId } });
    const isFirst = priorCount === 0;
    const hasPhoto = photoUrls.length > 0;
    const hasReceipt = receiptUrl !== null;
    if (!isFirst && !hasReceipt) {
      return NextResponse.json(
        { error: "두번째 리뷰부터는 구매 영수증 인증이 필요해요.", code: "receipt_required" },
        { status: 400 },
      );
    }

    // 자동 모더레이션: 욕설·음란·광고 → 임시 보관(held). 삭제가 아니라 비공개 보류.
    const screen = screenReview([content, ...tags].join(" "));
    const held = screen.flagged;

    // 별점/포인트 반영(scored): 같은 날(KST) 이 가게에 반영 리뷰가 이미 있으면 미반영.
    // 임시 보관(held)도 미반영(별점·포인트 보류) — 관리자 복원 시 반영/적립.
    const todayScored = await prisma.review.count({
      where: { userId, storeId, scored: true, createdAt: { gte: kstTodayStart() } },
    });
    const scored = todayScored === 0 && !held;

    const base = (await getPointConfig()).review;
    const grant = scored ? reviewGrant(base, isFirst, hasPhoto) : 0;

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          storeId,
          userId,
          rating,
          content,
          tags,
          productIds: linkedIds,
          photoUrls,
          receiptUrl,
          scored,
          held,
          heldReason: held ? screen.reason : null,
          heldAt: held ? new Date() : null,
        },
      });
      if (grant > 0) {
        await tx.pointLog.create({
          data: {
            userId,
            amount: grant,
            reason: isFirst ? "첫 리뷰 작성" : "영수증 리뷰 작성",
            status: "pending",
            refType: "review",
            refId: created.id,
          },
        });
      }
      return created;
    });

    return NextResponse.json({
      ok: true,
      reviewId: review.id,
      pointPending: grant,
      isFirst,
      scored,
      held,
    });
  } catch {
    return NextResponse.json({ error: "리뷰 등록에 실패했어요." }, { status: 500 });
  }
}
