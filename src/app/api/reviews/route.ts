import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/** 리뷰 작성/평점 (스펙 Phase 3). */
export const runtime = "nodejs";

type Body = { storeId?: string; rating?: number; content?: string };

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
    const review = await prisma.review.create({
      data: { storeId, userId, rating, content: content.trim() },
    });
    return NextResponse.json({ ok: true, reviewId: review.id });
  } catch {
    return NextResponse.json({ error: "리뷰 등록에 실패했어요." }, { status: 500 });
  }
}
