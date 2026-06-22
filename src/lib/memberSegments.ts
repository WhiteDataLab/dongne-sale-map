import { prisma } from "@/lib/prisma";
import { getLaunchFlags } from "@/lib/launchFlags";
import { liveSponsorFilter } from "@/lib/sponsors";

/**
 * 관리자 '회원 구성' 시각화용 집계.
 * - 권한 분포: 일반인(user) / 사장님(merchant) / 관리자(admin)
 * - 사장님 세부: 인증 여부(무료 오픈 모드에서 라이트 기능 개방 대상) + 구독 등급(라이트/스폰서/프로)
 *
 * 현재는 무료 오픈 모드라 유료 구독이 0건인 게 정상이다. 이 화면은 유료 오픈 시점을 대비해
 * 구조를 미리 보여주고, 무료모드에서 '인증 사장님(라이트 무료 개방)' 규모를 파악하는 용도.
 */
export type MerchantTierKey = "free" | "lite" | "sponsor" | "pro";

export const MERCHANT_TIER_META: { key: MerchantTierKey; label: string; color: string; note: string }[] = [
  { key: "free", label: "무료", color: "#94A3B8", note: "구독 없음 (무료 오픈 모드에선 인증 시 라이트 기능 개방)" },
  { key: "lite", label: "라이트", color: "#3182F6", note: "세일 알림·단골·리뷰 답글·공식 배지(관계)" },
  { key: "sponsor", label: "스폰서", color: "#EAB308", note: "지도 노출 부스트(마퀴 고정 + 금색 핀)" },
  { key: "pro", label: "프로", color: "#6366F1", note: "라이트 전체 + 노출 + 프리미엄 혜택" },
];

export const ROLE_META: { key: "user" | "merchant" | "admin"; label: string; color: string }[] = [
  { key: "user", label: "일반인", color: "#3182F6" },
  { key: "merchant", label: "사장님", color: "#F59E0B" },
  { key: "admin", label: "관리자", color: "#A855F7" },
];

export type MemberSegments = {
  total: number;
  roles: { user: number; merchant: number; admin: number };
  merchant: {
    total: number;
    verified: number; // 인증 가게 소유(무료모드 라이트 개방 대상)
    unverifiedOnly: number; // 가게는 있으나 전부 미인증
    noStore: number; // 사장님 권한이나 소유 가게 없음
    tiers: Record<MerchantTierKey, number>; // 구독(trialing/active) 기준 — 무료모드에선 free 에 집중
  };
  liveSponsorStores: number; // 현재 노출 중인 스폰서 가게 수(노출 add-on)
  liveSubscriptions: number; // 현재 라이브 구독 수(trialing/active)
  monetization: boolean; // 런치 플래그(유료 진입점 노출 여부)
};

const NOT_GHOST = { providerId: { not: "deleted-user" } } as const;
const PLAN_RANK: Record<string, number> = { pro: 3, sponsor: 2, lite: 1 };

export async function getMemberSegments(): Promise<MemberSegments> {
  const [byRole, merchants, liveSubs, liveSponsors, flags] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], where: NOT_GHOST, _count: true }),
    prisma.user.findMany({
      where: { role: "merchant", ...NOT_GHOST },
      select: { id: true, ownedStores: { where: { status: "active" }, select: { verified: true } } },
    }),
    prisma.subscription.findMany({
      where: { status: { in: ["trialing", "active"] } },
      select: { userId: true, plan: true },
    }),
    prisma.sponsorship.findMany({ where: liveSponsorFilter(), select: { storeId: true } }),
    getLaunchFlags(),
  ]);

  const roles = { user: 0, merchant: 0, admin: 0 };
  for (const g of byRole) {
    if (g.role === "user") roles.user = g._count;
    else if (g.role === "merchant") roles.merchant = g._count;
    else if (g.role === "admin") roles.admin = g._count;
  }

  // 사장님 인증/가게 보유 분류
  let verified = 0;
  let unverifiedOnly = 0;
  let noStore = 0;
  for (const m of merchants) {
    if (m.ownedStores.length === 0) noStore++;
    else if (m.ownedStores.some((s) => s.verified)) verified++;
    else unverifiedOnly++;
  }

  // 구독 등급: 사장님(userId)별 최상위 플랜 1개로 집계.
  const bestByUser = new Map<string, string>();
  for (const s of liveSubs) {
    const cur = bestByUser.get(s.userId);
    if (!cur || (PLAN_RANK[s.plan] ?? 0) > (PLAN_RANK[cur] ?? 0)) bestByUser.set(s.userId, s.plan);
  }
  const tiers: Record<MerchantTierKey, number> = { free: 0, lite: 0, sponsor: 0, pro: 0 };
  for (const plan of bestByUser.values()) {
    if (plan === "pro") tiers.pro++;
    else if (plan === "sponsor") tiers.sponsor++;
    else tiers.lite++;
  }
  tiers.free = Math.max(0, roles.merchant - (tiers.lite + tiers.sponsor + tiers.pro));

  return {
    total: roles.user + roles.merchant + roles.admin,
    roles,
    merchant: { total: roles.merchant, verified, unverifiedOnly, noStore, tiers },
    liveSponsorStores: new Set(liveSponsors.map((s) => s.storeId)).size,
    liveSubscriptions: liveSubs.length,
    monetization: flags.monetization,
  };
}
