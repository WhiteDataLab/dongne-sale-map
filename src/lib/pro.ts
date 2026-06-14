import { prisma } from "@/lib/prisma";
import { liveSponsorFilter } from "@/lib/sponsors";

/**
 * M4(수익화) — 프로 플랜 게이팅.
 * '프로'= 현재 라이브 스폰서십(status∈{trial,active}, endsAt>now)이면서 그 구독.plan="pro".
 * 노출(마퀴+금색핀)은 sponsor/pro 공통(스폰서십)으로 처리되고, 아래 프리미엄 혜택만 프로로 게이팅한다.
 */

/** 프로 플랜 혜택 한도. */
export const FREE_COUPON_ACTIVE_LIMIT = 20;
export const PRO_COUPON_ACTIVE_LIMIT = 200; // 프로: 사실상 무제한
export const PRO_GALLERY_MAX = 8; // 프로 사진 갤러리 최대 장수

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
