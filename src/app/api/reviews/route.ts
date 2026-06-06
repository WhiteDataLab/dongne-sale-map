import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/**
 * 리뷰 작성/평점 (스펙 Phase 3 + 사진/포인트 정책).
 * 포인트(pending +10):
 *  - 최초 리뷰: 글만 써도 지급
 *  - 2번째부터: 사진을 함께 올려야 지급(글만이면 0)
 */
export const runtime = "nodejs";

const POINT_REVIEW = 10;

type Body = { storeId?: string; rating?: number; content?: string; photoUrls?: unknown };

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

  const { storeId, rating, content } = body;
  const photoUrls = Array.isArray(body.photoUrls)
    ? body.photoUrls.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 5)
    : [];

  if (!storeId || !content?.trim()) {
    return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });
  }
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "평점은 1~5 사이여야 해요." }, { status: 400 });
  }

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }

    // 포인트 정책: 최초 리뷰는 무조건, 이후엔 사진 있을 때만
    const priorCount = await prisma.review.count({ where: { userId } });
    const isFirst = priorCount === 0;
    const hasPhoto = photoUrls.length > 0;
    const grant = isFirst || hasPhoto ? POINT_REVIEW : 0;

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: { storeId, userId, rating, content: content.trim(), photoUrls },
      });
      if (grant > 0) {
        await tx.pointLog.create({
          data: {
            userId,
            amount: grant,
            reason: isFirst ? "첫 리뷰 작성" : "사진 리뷰 작성",
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
    });
  } catch {
    return NextResponse.json({ error: "리뷰 등록에 실패했어요." }, { status: 500 });
  }
}
