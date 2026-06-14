import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META, type Category } from "@/lib/constants";

/**
 * M1-A(수익화) — 스폰서(정액 광고) 헬퍼.
 * 상품 = 묶음(bundle): 지도 상단 마퀴 고정 + 금색 핀. 가격 = 월 29,800원, 14일 무료체험.
 * 결제(PG)는 M2에서 연결 — 체험은 과금 없이 동작, 유료 전환은 입금 확인 후 관리자 수동 처리.
 *
 * '노출 중(live)' 판정은 endsAt(시각) 기준 — Sale.expiresAt 과 같은 패턴이라 만료 크론이 필요 없다.
 */

export const SPONSOR_PRICE_KRW = 29_800;
/** M4: 프로 플랜 — 스폰서(마퀴+금색핀) + 프리미엄 혜택 4종 묶음. */
export const PRO_PRICE_KRW = 49_800;
export const TRIAL_DAYS = 14;
export const PAID_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 구독 플랜. sponsor=마퀴+금색핀 / pro=스폰서 전체 + 확장통계·무제한쿠폰·사진갤러리·상위노출. */
export type SubPlan = "sponsor" | "pro";

export const PLAN_PRICE_KRW: Record<SubPlan, number> = {
  sponsor: SPONSOR_PRICE_KRW,
  pro: PRO_PRICE_KRW,
};
export const PLAN_LABEL: Record<SubPlan, string> = {
  sponsor: "스폰서",
  pro: "프로",
};
export function asSubPlan(v: unknown): SubPlan {
  return v === "pro" ? "pro" : "sponsor";
}

/** M2: 토스 결제 주문명(고객 카드명세서 표기) + 연속 실패 N회 시 자동 해지. */
export const SUBSCRIPTION_ORDER_NAME = "동네세일지도 스폰서 광고(월)";
export const PLAN_ORDER_NAME: Record<SubPlan, string> = {
  sponsor: "동네세일지도 스폰서 광고(월)",
  pro: "동네세일지도 프로 플랜(월)",
};
export const MAX_BILLING_FAILURES = 3;

export const SPONSOR_STATUS_LABEL: Record<string, string> = {
  trial: "무료체험",
  active: "유료활성",
  expired: "만료",
  canceled: "취소",
};

/** 노출 보장 상태(체험·유료) — endsAt 가 미래여야 실제 노출. */
const LIVE_STATUSES = ["trial", "active"] as const;

/** 현재 노출 중인 스폰서만 거르는 Prisma 필터(status ∈ {trial,active} AND endsAt > now). */
export function liveSponsorFilter(now: Date = new Date()): Prisma.SponsorshipWhereInput {
  return { status: { in: [...LIVE_STATUSES] }, endsAt: { gt: now } };
}

/** 주어진 가게 id 중 '현재 노출 중'인 스폰서 가게 id 집합. (지도 핀/피드에서 사용) */
export async function getLiveSponsorStoreIds(
  storeIds: string[],
  now: Date = new Date(),
): Promise<Set<string>> {
  if (storeIds.length === 0) return new Set();
  const rows = await prisma.sponsorship.findMany({
    where: { ...liveSponsorFilter(now), storeId: { in: storeIds } },
    select: { storeId: true },
  });
  return new Set(rows.map((r) => r.storeId));
}

export type SponsorRow = {
  id: string;
  storeId: string;
  storeName: string;
  category: Category;
  categoryLabel: string;
  address: string;
  region: string;
  status: string;
  live: boolean; // 현재 실제 노출 중인지(endsAt 기준)
  priceKrw: number;
  trialEndsAt: string;
  startsAt: string;
  endsAt: string;
  daysLeft: number; // endsAt 까지 남은 일수(음수면 만료)
  note: string | null;
  createdAt: string;
  subscriptionId: string | null; // M2: 자동결제 구독 발이면 연결
  subStatus: string | null; // 구독 상태(trialing|active|past_due|canceled)
  subPlan: SubPlan | null; // M4: 구독 플랜(sponsor|pro)
  nextBillingAt: string | null; // 다음 결제 예정(자동결제 발만)
};

/** 관리 화면용: 전 스폰서 목록(최신순) + 가게 정보 + 남은 일수. */
export async function getSponsorships(): Promise<SponsorRow[]> {
  const now = new Date();
  const rows = await prisma.sponsorship.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      storeId: true,
      plan: true,
      region: true,
      status: true,
      priceKrw: true,
      trialEndsAt: true,
      startsAt: true,
      endsAt: true,
      note: true,
      createdAt: true,
      subscriptionId: true,
      store: { select: { name: true, category: true, address: true } },
      subscription: { select: { status: true, plan: true, nextBillingAt: true } },
    },
  });

  return rows.map((s) => {
    const live = (LIVE_STATUSES as readonly string[]).includes(s.status) && s.endsAt > now;
    return {
      id: s.id,
      storeId: s.storeId,
      storeName: s.store.name,
      category: s.store.category as Category,
      categoryLabel: CATEGORY_META[s.store.category as Category]?.label ?? s.store.category,
      address: s.store.address,
      region: s.region,
      status: s.status,
      live,
      priceKrw: s.priceKrw,
      trialEndsAt: s.trialEndsAt.toISOString(),
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      daysLeft: Math.ceil((s.endsAt.getTime() - now.getTime()) / DAY_MS),
      note: s.note,
      createdAt: s.createdAt.toISOString(),
      subscriptionId: s.subscriptionId,
      subStatus: s.subscription?.status ?? null,
      subPlan: s.subscription ? asSubPlan(s.subscription.plan) : null,
      nextBillingAt: s.subscription?.nextBillingAt?.toISOString() ?? null,
    };
  });
}

/** 무료체험 시작 시 종료 시각(now + 14일). */
export function trialEndDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * DAY_MS);
}

/** 유료 1주기 연장 종료 시각(기준 시각 + 30일). 기준은 기존 endsAt(미래면)·아니면 now. */
export function extendPaidDate(currentEndsAt: Date, from: Date = new Date()): Date {
  const base = currentEndsAt > from ? currentEndsAt : from;
  return new Date(base.getTime() + PAID_PERIOD_DAYS * DAY_MS);
}

/** 주소에서 동네 라벨(동/읍/면/가) 추출 — 실패 시 '구독'. (영업/관리 표시용) */
export function regionFromAddress(address: string): string {
  const m = address.match(/([가-힣]+(?:동|읍|면|가))/);
  return m?.[1] ?? "구독";
}

/** 가게의 현재 활성(노출 보장 중인) 구독 — 진입점 DTO·중복 구독 가드용. */
export async function getActiveSubscriptionForStore(storeId: string) {
  return prisma.subscription.findFirst({
    where: { storeId, status: { in: ["trialing", "active", "past_due"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, plan: true, nextBillingAt: true, trialEndsAt: true },
  });
}

/**
 * M2: 카드 등록(빌링키 발급) 직후 14일 무료체험 구독 + 즉시 노출 스폰서를 함께 생성(트랜잭션).
 * 노출은 체험 시작과 동시에 켜진다(endsAt = 체험종료). 첫 청구는 nextBillingAt(=체험종료)에 크론이 수행.
 */
export async function createTrialSubscription(opts: {
  storeId: string;
  userId: string;
  customerKey: string;
  billingKey: string;
  region: string;
  plan?: SubPlan; // 기본 sponsor. pro 면 프리미엄 혜택까지 활성(가격만 다르고 노출 스폰서는 동일 생성).
}) {
  const now = new Date();
  const ends = trialEndDate(now);
  const plan: SubPlan = opts.plan ?? "sponsor";
  const price = PLAN_PRICE_KRW[plan];
  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        storeId: opts.storeId,
        userId: opts.userId,
        customerKey: opts.customerKey,
        billingKey: opts.billingKey,
        plan,
        status: "trialing",
        priceKrw: price,
        trialEndsAt: ends,
        nextBillingAt: ends,
      },
    });
    await tx.sponsorship.create({
      data: {
        storeId: opts.storeId,
        plan, // 운영 표시용(노출은 sponsor/pro 동일, 프리미엄 게이팅은 subscription.plan 기준)
        region: opts.region,
        status: "trial",
        priceKrw: price,
        trialEndsAt: ends,
        startsAt: now,
        endsAt: ends,
        subscriptionId: sub.id,
      },
    });
    return sub;
  });
}
