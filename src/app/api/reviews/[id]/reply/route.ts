import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import { storeTier, tierAllowsLite } from "@/lib/pro";
import { rateLimit } from "@/lib/rateLimit";

/**
 * M8(수익화) — 사장님 리뷰 답글(라이트+ '관계' 기능).
 * 인증 사장님(소유자)·관리자가 본인 가게 리뷰에 1:1 답글을 달거나(POST=upsert) 삭제(DELETE)한다.
 * 게이팅: canManageStore + 가게 기능 티어가 lite 이상.
 */
export const runtime = "nodejs";

const REPLY_BODY_MAX = 500;

/** 리뷰 → 가게 로드 + 권한·티어 게이팅 공통. */
async function authorize(reviewId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "login_required" }, { status: 401 }) };

  const review = await prisma.review
    .findUnique({
      where: { id: reviewId },
      select: { id: true, hidden: true, held: true, store: { select: { id: true, ownerId: true, status: true } } },
    })
    .catch(() => null);
  if (!review || review.hidden || review.held || review.store.status !== "active") {
    return { error: NextResponse.json({ error: "리뷰를 찾을 수 없어요." }, { status: 404 }) };
  }
  if (!canManageStore(review.store, user)) {
    return { error: NextResponse.json({ error: "사장님·관리자만 답글을 달 수 있어요." }, { status: 403 }) };
  }
  return { user, review };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;
  const { user, review } = auth;

  // 라이트+ 게이팅(노출과 분리된 기능 티어).
  if (!tierAllowsLite(await storeTier(review.store.id))) {
    return NextResponse.json(
      { error: "리뷰 답글은 라이트 플랜부터 사용할 수 있어요.", code: "tier_required" },
      { status: 402 },
    );
  }

  // 도배 방지: 사용자당 1분 20회.
  const { ok } = await rateLimit(`review-reply:${user.id}`, 20, 60_000);
  if (!ok) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });

  let body: string;
  try {
    body = String((((await req.json()) as { body?: unknown }).body ?? "")).trim();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: "답글 내용을 입력해 주세요." }, { status: 400 });
  body = body.slice(0, REPLY_BODY_MAX);

  // 리뷰당 1개 → upsert(작성/수정 공용). 작성자(authorId)는 갱신 시 현재 관리자로 기록.
  await prisma.reviewReply.upsert({
    where: { reviewId: id },
    create: { reviewId: id, storeId: review.store.id, authorId: user.id, body },
    update: { body, authorId: user.id },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;

  await prisma.reviewReply.deleteMany({ where: { reviewId: id } });
  return NextResponse.json({ ok: true });
}
