import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  asSubPlan,
  type SubPlan,
  planHasExposure,
  regionFromAddress,
  PLAN_PRICE_KRW,
  PLAN_ORDER_NAME,
  PAID_PERIOD_DAYS,
} from "@/lib/sponsors";
import { chargeBilling, isTossConfigured, TossError } from "@/lib/toss";

/**
 * M6 — 구독 플랜 인플레이스 변경(스폰서 ↔ 프로). 구독한 사장님 본인 또는 관리자만.
 *
 * 악용 방지(낮은 금액으로 상위 플랜 이용) — 업그레이드 시 **남은 기간 차액을 즉시 일할 청구**한다:
 *  - trialing(무료체험): 추가청구 없음. 체험 종료 시 첫 결제가 새 플랜 가격으로 청구되므로 공정.
 *  - active(유료): (새가격-현가격) × (다음결제까지 남은 비율) 을 즉시 결제. 실패 시 변경 취소.
 *  - 다운그레이드: 환불 없음. 혜택 즉시 해제, 다음 결제부터 낮은 금액.
 *  - past_due: 결제 실패 상태에선 변경 불가.
 * 프로 게이팅은 '구독.plan=pro' 기준이라 plan 변경 즉시 혜택이 반영된다. 노출 기간(endsAt)은 유지.
 */
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let plan: SubPlan;
  try {
    plan = asSubPlan(((await req.json()) as { plan?: string }).plan);
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const sub = await prisma.subscription
    .findUnique({
      where: { id },
      select: {
        userId: true,
        storeId: true,
        status: true,
        plan: true,
        priceKrw: true,
        nextBillingAt: true,
        billingKey: true,
        customerKey: true,
      },
    })
    .catch(() => null);
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.role !== "admin" && sub.userId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (sub.status === "canceled") {
    return NextResponse.json({ error: "해지된 구독은 변경할 수 없어요." }, { status: 409 });
  }
  if (sub.status === "past_due") {
    return NextResponse.json({ error: "결제 실패 상태에서는 플랜을 변경할 수 없어요." }, { status: 409 });
  }
  if (sub.plan === plan) return NextResponse.json({ ok: true, plan });

  const newPrice = PLAN_PRICE_KRW[plan];
  const now = new Date();
  const upgrading = newPrice > sub.priceKrw;

  // 유료(active) 업그레이드 → 남은 기간 차액을 즉시 일할 청구.
  if (upgrading && sub.status === "active") {
    const remainMs = sub.nextBillingAt.getTime() - now.getTime();
    const fraction = Math.max(0, Math.min(1, remainMs / (PAID_PERIOD_DAYS * DAY_MS)));
    const diff = Math.round((newPrice - sub.priceKrw) * fraction);

    if (diff > 0) {
      if (!isTossConfigured() || !sub.billingKey) {
        // 결제 미설정(개발/테스트) → 차액 청구 없이 전환만. 운영에선 키 설정 필수.
      } else {
        const orderId = `upg_${id}_${Date.now()}`;
        try {
          const result = await chargeBilling(sub.billingKey, {
            customerKey: sub.customerKey,
            amount: diff,
            orderId,
            orderName: `${PLAN_ORDER_NAME[plan]} 업그레이드 차액`,
          });
          await prisma.payment.create({
            data: {
              subscriptionId: id,
              storeId: sub.storeId,
              orderId,
              amount: diff,
              status: "paid",
              tossPaymentKey: result.paymentKey,
              method: result.method ?? null,
            },
          });
        } catch (e) {
          const reason = e instanceof TossError ? `${e.code}: ${e.message}` : "결제 오류";
          return NextResponse.json(
            { error: `업그레이드 차액 결제에 실패했어요. (${reason})` },
            { status: 402 },
          );
        }
      }
    }
  }

  // M8: 노출(Sponsorship)은 sponsor/pro 만 가진다. 플랜 변경 시 노출도 함께 reconcile.
  const wantExposure = planHasExposure(plan);
  const liveSp = await prisma.sponsorship.findFirst({
    where: { subscriptionId: id, status: { in: ["trial", "active"] }, endsAt: { gt: now } },
    orderBy: { endsAt: "desc" },
    select: { id: true, region: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({ where: { id }, data: { plan, priceKrw: newPrice } });

    if (wantExposure) {
      if (liveSp) {
        // 이미 노출 중(sponsor↔pro) → plan/가격만 맞춤. 노출 기간(endsAt)은 유지.
        await tx.sponsorship.update({ where: { id: liveSp.id }, data: { plan, priceKrw: newPrice } });
      } else {
        // lite→sponsor/pro 업그레이드: 노출이 없었으므로 현재 결제 주기까지 노출 생성.
        const store = await tx.store.findUnique({ where: { id: sub.storeId }, select: { address: true } });
        await tx.sponsorship.create({
          data: {
            storeId: sub.storeId,
            plan,
            region: store ? regionFromAddress(store.address) : "구독",
            status: sub.status === "active" ? "active" : "trial",
            priceKrw: newPrice,
            trialEndsAt: sub.nextBillingAt,
            startsAt: now,
            endsAt: sub.nextBillingAt,
            subscriptionId: id,
          },
        });
      }
    } else if (liveSp) {
      // pro/sponsor→lite 다운그레이드: 노출 즉시 종료(환불 없음, 혜택 즉시 해제 정책과 일관).
      await tx.sponsorship.update({ where: { id: liveSp.id }, data: { status: "canceled", endsAt: now } });
    }
  });

  return NextResponse.json({ ok: true, plan });
}
