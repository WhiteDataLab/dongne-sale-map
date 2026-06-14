import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type Category } from "@/lib/constants";

/**
 * M3(수익화) — 사장님 쿠폰 헬퍼.
 * 인증 사장님(소유자)·관리자가 본인 가게 쿠폰을 발행하고, 소비자가 받아(claim) 매장에서 사용(use)한다.
 * '노출 중(live)' 판정은 expiresAt(시각) 기준 — Sale 과 같은 패턴이라 만료 크론이 필요 없다.
 */

/** 쿠폰 제목/조건 최대 길이(서버에서 자른다). */
export const COUPON_TITLE_MAX = 60;
export const COUPON_TEXT_MAX = 200;
/** 발행 시 만료까지 최소/최대 일수(앱 레벨 가드). */
export const COUPON_MAX_DAYS = 180;

/** 현재 노출 중인 쿠폰만 거르는 Prisma 필터(status=active AND expiresAt>now). */
export function liveCouponFilter(now: Date = new Date()): Prisma.CouponWhereInput {
  return { status: "active", expiresAt: { gt: now } };
}

/** 소비자/사장님 공용 쿠폰 DTO. usedCount 는 사장님 패널에서만 의미. */
export type CouponDTO = {
  id: string;
  title: string;
  description: string | null;
  condition: string | null;
  expiresAt: string;
  totalLimit: number | null;
  claimedCount: number; // 받은 수(전체)
  usedCount: number; // 사용된 수(사장님 통계)
  remaining: number | null; // 남은 수량(무제한이면 null)
  soldOut: boolean; // 한도 소진
  myClaimStatus: "claimed" | "used" | null; // 로그인 소비자 기준(미로그인/미보유 null)
};

/** 가게 상세용: 현재 노출 중인 쿠폰 + 받음/사용 카운트 + (로그인 시) 내 보유 상태. */
export async function getStoreCoupons(
  storeId: string,
  userId: string | null,
  now: Date = new Date(),
): Promise<CouponDTO[]> {
  const rows = await prisma.coupon.findMany({
    where: { ...liveCouponFilter(now), storeId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      condition: true,
      expiresAt: true,
      totalLimit: true,
      _count: { select: { claims: true } },
    },
  });
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  // 사용(used) 카운트는 상태별 집계가 필요 → groupBy.
  const usedGroups = await prisma.couponClaim.groupBy({
    by: ["couponId"],
    where: { couponId: { in: ids }, status: "used" },
    _count: { _all: true },
  });
  const usedMap = new Map(usedGroups.map((g) => [g.couponId, g._count._all]));

  // 로그인 사용자의 보유 상태.
  const myMap = new Map<string, "claimed" | "used">();
  if (userId) {
    const mine = await prisma.couponClaim.findMany({
      where: { userId, couponId: { in: ids } },
      select: { couponId: true, status: true },
    });
    for (const c of mine) myMap.set(c.couponId, c.status);
  }

  return rows.map((r) => {
    const claimedCount = r._count.claims;
    const remaining = r.totalLimit != null ? Math.max(0, r.totalLimit - claimedCount) : null;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      condition: r.condition,
      expiresAt: r.expiresAt.toISOString(),
      totalLimit: r.totalLimit,
      claimedCount,
      usedCount: usedMap.get(r.id) ?? 0,
      remaining,
      soldOut: remaining != null && remaining <= 0,
      myClaimStatus: myMap.get(r.id) ?? null,
    };
  });
}

/** 내 쿠폰함(받은 쿠폰) DTO. */
export type MyCouponDTO = {
  claimId: string;
  couponId: string;
  title: string;
  description: string | null;
  condition: string | null;
  expiresAt: string;
  storeId: string;
  storeName: string;
  category: Category;
  status: "claimed" | "used";
  usedAt: string | null;
  expired: boolean; // 쿠폰이 만료/내려감(사용 불가)
};

/** /coupons (내 쿠폰함): 받은 쿠폰을 최신순으로. */
export async function getMyCoupons(userId: string, now: Date = new Date()): Promise<MyCouponDTO[]> {
  const claims = await prisma.couponClaim.findMany({
    where: { userId },
    orderBy: { claimedAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      usedAt: true,
      coupon: {
        select: {
          id: true,
          title: true,
          description: true,
          condition: true,
          expiresAt: true,
          status: true,
          store: { select: { id: true, name: true, category: true } },
        },
      },
    },
  });

  return claims.map((c) => ({
    claimId: c.id,
    couponId: c.coupon.id,
    title: c.coupon.title,
    description: c.coupon.description,
    condition: c.coupon.condition,
    expiresAt: c.coupon.expiresAt.toISOString(),
    storeId: c.coupon.store.id,
    storeName: c.coupon.store.name,
    category: c.coupon.store.category as Category,
    status: c.status,
    usedAt: c.usedAt?.toISOString() ?? null,
    expired: c.coupon.status !== "active" || c.coupon.expiresAt <= now,
  }));
}
