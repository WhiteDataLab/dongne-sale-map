import { prisma } from "@/lib/prisma";
import { liveSponsorFilter } from "@/lib/sponsors";

/**
 * M4(수익화) — 프로 플랜 게이팅.
 * '프로'= 현재 라이브 스폰서십(status∈{trial,active}, endsAt>now)이면서 그 구독.plan="pro".
 * 노출(마퀴+금색핀)은 sponsor/pro 공통(스폰서십)으로 처리되고, 아래 프리미엄 혜택만 프로로 게이팅한다.
 */

/** 프로 플랜 혜택 한도. */
export const FREE_COUPON_ACTIVE_LIMIT = 20;
export const LITE_COUPON_ACTIVE_LIMIT = 50; // M8: 라이트 — 무료보다 넉넉
export const PRO_COUPON_ACTIVE_LIMIT = 200; // 프로: 사실상 무제한
export const PRO_GALLERY_MAX = 8; // 프로 사진 갤러리 최대 장수

/**
 * M8 — 기능 티어. 노출(Sponsorship)과 분리된 '구독 플랜' 기반 판정.
 * - pro  : 구독.plan=pro (라이트 전체 + 노출 + 프리미엄 혜택)
 * - lite : 구독.plan=lite (세일 알림·단골·리뷰 답글·공식 배지)
 * - free : 구독 없음 또는 sponsor(노출 전용 add-on, 기능은 무료와 동일)
 */
export type StoreTier = "free" | "lite" | "pro";

/** 라이트 이상(=관계 기능 사용 가능) 여부. */
export function tierAllowsLite(t: StoreTier): boolean {
  return t === "lite" || t === "pro";
}

/** 쿠폰 활성 한도(티어별). */
export function couponLimitForTier(t: StoreTier): number {
  return t === "pro" ? PRO_COUPON_ACTIVE_LIMIT : t === "lite" ? LITE_COUPON_ACTIVE_LIMIT : FREE_COUPON_ACTIVE_LIMIT;
}

/** 단일 가게의 현재 기능 티어. 활성(체험 포함) 구독의 plan 으로 판정. */
export async function storeTier(storeId: string): Promise<StoreTier> {
  const sub = await prisma.subscription.findFirst({
    where: { storeId, status: { in: ["trialing", "active"] } },
    orderBy: { createdAt: "desc" },
    select: { plan: true },
  });
  if (!sub) return "free";
  if (sub.plan === "pro") return "pro";
  if (sub.plan === "lite") return "lite";
  return "free"; // sponsor → 노출 add-on, 기능은 무료
}

/** 주어진 가게 id 중 현재 '프로'로 노출 중인 가게 집합. (목록/지도 상위 노출·배지용) */
export async function getProStoreIds(
  storeIds: string[],
  now: Date = new Date(),
): Promise<Set<string>> {
  if (storeIds.length === 0) return new Set();
  const rows = await prisma.sponsorship.findMany({
    where: { ...liveSponsorFilter(now), storeId: { in: storeIds }, subscription: { plan: "pro" } },
    select: { storeId: true },
  });
  return new Set(rows.map((r) => r.storeId));
}

/** 단일 가게가 현재 프로 플랜인지. (혜택 한도·관리 권한 게이팅용) */
export async function isStorePro(storeId: string, now: Date = new Date()): Promise<boolean> {
  const found = await prisma.sponsorship.findFirst({
    where: { ...liveSponsorFilter(now), storeId, subscription: { plan: "pro" } },
    select: { id: true },
  });
  return Boolean(found);
}
