import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chargeBilling, isTossConfigured, TossError } from "@/lib/toss";
import {
  SUBSCRIPTION_ORDER_NAME,
  MAX_BILLING_FAILURES,
  PAID_PERIOD_DAYS,
  extendPaidDate,
} from "@/lib/sponsors";

/**
 * M2 — 정기결제 크론(매일 1회). nextBillingAt 가 도래한 구독을 빌링키로 청구한다.
 * 보호: Authorization: Bearer CRON_SECRET (Vercel Cron 이 자동 첨부). 미설정 시 401.
 * 성공 → 구독 active + 다음 청구 +30일 + 연결 스폰서 노출 +30일. 실패 → past_due, 누적 N회면 해지.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 100;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isTossConfigured()) {
    return NextResponse.json({ ok: true, skipped: "toss_not_configured" });
  }

  const now = new Date();
  const due = await prisma.subscription.findMany({
    where: {
      status: { in: ["trialing", "active", "past_due"] },
      nextBillingAt: { lte: now },
      billingKey: { not: null },
    },
    orderBy: { nextBillingAt: "asc" },
    take: BATCH,
  });

  let charged = 0;
  let failed = 0;

  for (const sub of due) {
    const orderId = `sub_${sub.id}_${Date.now()}`;
    try {
      const result = await chargeBilling(sub.billingKey as string, {
        customerKey: sub.customerKey,
        amount: sub.priceKrw,
        orderId,
        orderName: SUBSCRIPTION_ORDER_NAME,
      });

      // 연결된 스폰서(가장 최근) 노출 +30일 — 없으면 방어적으로 생성.
      const sponsorship = await prisma.sponsorship.findFirst({
        where: { subscriptionId: sub.id },
        orderBy: { endsAt: "desc" },
      });
      const nextEnds = extendPaidDate(sponsorship?.endsAt ?? now, now);

      await prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            subscriptionId: sub.id,
            storeId: sub.storeId,
            orderId,
            amount: sub.priceKrw,
            status: "paid",
            tossPaymentKey: result.paymentKey,
            method: result.method ?? null,
          },
        });
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: "active",
            failCount: 0,
            lastPaymentAt: now,
            nextBillingAt: extendPaidDate(sub.nextBillingAt, now),
          },
        });
        if (sponsorship) {
          await tx.sponsorship.update({
            where: { id: sponsorship.id },
            data: { status: "active", endsAt: nextEnds },
          });
        } else {
          await tx.sponsorship.create({
            data: {
              storeId: sub.storeId,
              region: "구독",
              status: "active",
              priceKrw: sub.priceKrw,
              trialEndsAt: now,
              startsAt: now,
              endsAt: nextEnds,
              subscriptionId: sub.id,
            },
          });
        }
      });
      charged++;
    } catch (e) {
      failed++;
      const reason = e instanceof TossError ? `${e.code}: ${e.message}` : "청구 오류";
      const nextFail = sub.failCount + 1;
      const giveUp = nextFail >= MAX_BILLING_FAILURES;
      await prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            subscriptionId: sub.id,
            storeId: sub.storeId,
            orderId,
            amount: sub.priceKrw,
            status: "failed",
            failReason: reason.slice(0, 300),
          },
        });
        await tx.subscription.update({
          where: { id: sub.id },
          data: giveUp
            ? { status: "canceled", canceledAt: now, failCount: nextFail }
            : { status: "past_due", failCount: nextFail, nextBillingAt: new Date(now.getTime() + DAY_MS) },
        });
      });
    }
  }

  return NextResponse.json({ ok: true, due: due.length, charged, failed, periodDays: PAID_PERIOD_DAYS });
}
