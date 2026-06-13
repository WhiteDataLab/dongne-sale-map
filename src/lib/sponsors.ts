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
export const TRIAL_DAYS = 14;
export const PAID_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

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
      store: { select: { name: true, category: true, address: true } },
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
