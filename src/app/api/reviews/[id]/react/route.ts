import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/** 리뷰 좋아요/싫어요 토글 (1인 1리뷰 1반응). */
export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: reviewId } = await ctx.params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let body: { kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const kind = body.kind === "like" ? "like" : body.kind === "dislike" ? "dislike" : null;
  if (!kind) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });

  try {
    const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { id: true } });
    if (!review) return NextResponse.json({ error: "리뷰를 찾을 수 없어요." }, { status: 404 });

    const existing = await prisma.reviewReaction.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });
    let myReaction: "like" | "dislike" | null = kind;
    if (!existing) {
      await prisma.reviewReaction.create({ data: { reviewId, userId, kind } });
    } else if (existing.kind === kind) {
      await prisma.reviewReaction.delete({ where: { id: existing.id } }); // 토글 해제
      myReaction = null;
    } else {
      await prisma.reviewReaction.update({ where: { id: existing.id }, data: { kind } });
    }

    const [likeCount, dislikeCount] = await Promise.all([
      prisma.reviewReaction.count({ where: { reviewId, kind: "like" } }),
      prisma.reviewReaction.count({ where: { reviewId, kind: "dislike" } }),
    ]);
    return NextResponse.json({ ok: true, likeCount, dislikeCount, myReaction });
  } catch {
    return NextResponse.json({ error: "처리에 실패했어요." }, { status: 500 });
  }
}
