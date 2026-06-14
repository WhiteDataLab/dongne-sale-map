import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { asSubPlan, PLAN_PRICE_KRW } from "@/lib/sponsors";

/**
 * M6 — 구독 플랜 인플레이스 변경(스폰서 ↔ 프로). 구독한 사장님 본인 또는 관리자만.
 * 프로 혜택 게이팅은 '라이브 스폰서십 + 구독.plan=pro' 이므로 plan 변경 즉시 혜택이 켜진다.
 * 가격(priceKrw)은 바뀌지만 즉시 추가청구는 없고 **다음 결제부터** 새 금액이 적용된다(크론이 sub.priceKrw로 청구).
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let plan: "sponsor" | "pro";
  try {
    plan = asSubPlan(((await req.json()) as { plan?: string }).plan);
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const sub = await prisma.subscription
    .findUnique({ where: { id }, select: { userId: true, status: true, plan: true } })
    .catch(() => null);
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.role !== "admin" && sub.userId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (sub.status === "canceled") {
    return NextResponse.json({ error: "해지된 구독은 변경할 수 없어요." }, { status: 409 });
  }
  if (sub.plan === plan) return NextResponse.json({ ok: true, plan });

  const price = PLAN_PRICE_KRW[plan];
  await prisma.$transaction([
    prisma.subscription.update({ where: { id }, data: { plan, priceKrw: price } }),
    // 연결 스폰서십 plan/가격도 맞춤(관리자 표기·다음 주기 일관성). 노출 기간(endsAt)은 그대로.
    prisma.sponsorship.updateMany({ where: { subscriptionId: id }, data: { plan, priceKrw: price } }),
  ]);

  return NextResponse.json({ ok: true, plan });
}
