import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * L4(수익화) — 지역 광고 플랫폼.
 * 식료품 밖 로컬 광고주에게 동네 타게팅 정액 광고를 판매한다(당근 비즈프로필 모델).
 * 노출은 현 지도에 보이는 가게들의 동(region) 과 광고 region 매칭으로 결정(GPS 미수집 원칙 유지).
 */

export const LOCALAD_CATEGORIES = ["부동산", "학원", "병원", "헬스장", "음식점", "기타"] as const;

/** 소비자 노출용 DTO(외부 노출 안전 필드만). */
export type LocalAdDTO = {
  id: string;
  advertiser: string;
  category: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  region: string;
};

/** 현재 노출 가능한 광고만 거르는 필터(status active + 기간 내). */
export function liveLocalAdFilter(now: Date = new Date()): Prisma.LocalAdWhereInput {
  return {
    status: "active",
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  };
}

/** 주어진 동네(region) 집합에 매칭되는 노출 광고. (피드에서 호출, 최대 take) */
export async function getLocalAdsForRegions(
  regions: string[],
  now: Date = new Date(),
  take = 3,
): Promise<LocalAdDTO[]> {
  if (regions.length === 0) return [];
  const rows = await prisma.localAd.findMany({
    where: { ...liveLocalAdFilter(now), region: { in: regions } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      advertiser: true,
      category: true,
      title: true,
      body: true,
      imageUrl: true,
      linkUrl: true,
      region: true,
    },
  });
  return rows;
}

/** 관리자 목록 DTO. */
export type LocalAdRow = LocalAdDTO & {
  status: "active" | "paused" | "ended";
  startsAt: string;
  endsAt: string | null;
  priceKrw: number;
  clicks: number;
  createdAt: string;
};

export async function getLocalAds(): Promise<LocalAdRow[]> {
  const rows = await prisma.localAd.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
  });
  return rows.map((a) => ({
    id: a.id,
    advertiser: a.advertiser,
    category: a.category,
    title: a.title,
    body: a.body,
    imageUrl: a.imageUrl,
    linkUrl: a.linkUrl,
    region: a.region,
    status: a.status as LocalAdRow["status"],
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt?.toISOString() ?? null,
    priceKrw: a.priceKrw,
    clicks: a.clicks,
    createdAt: a.createdAt.toISOString(),
  }));
}
