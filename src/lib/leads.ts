import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { kstDayString } from "@/lib/events";
import { CATEGORY_META, CATEGORIES, type Category } from "@/lib/constants";

/**
 * M1-B(수익화) — 영업 리드 추출.
 * "주인 없는(ownerId=null) 가게"를 활동도(노출·전환·콘텐츠)로 점수화해 핫리드 순으로 정렬.
 * 노출/전환 신호는 M0(StoreStatDaily) 최근 30일치를 사용 — 데이터가 쌓일수록 리드 품질이 올라간다.
 */

export const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "신규",
  contacted: "접촉",
  proposed: "제안",
  converted: "전환",
  dropped: "제외",
};

export const LEAD_STATUSES = ["new", "contacted", "proposed", "converted", "dropped"] as const;

export type LeadRow = {
  id: string;
  name: string;
  category: Category;
  categoryLabel: string;
  address: string;
  phone: string | null;
  createdAt: string;
  registeredBy: string;
  impressions30: number;
  detailOpens30: number;
  directionsClicks30: number;
  intentVisits30: number;
  sales: number;
  reviews: number;
  favorites: number;
  score: number;
  outreachStatus: string;
  outreachNote: string | null;
};

const CANDIDATE_CAP = 1000;

function isCategory(v: string | undefined | null): v is Category {
  return !!v && (CATEGORIES as string[]).includes(v);
}

/** 리드 점수: 전환신호(길찾기·방문의향) > 열람 > 노출, + 콘텐츠 활동(세일/리뷰/즐겨찾기). */
function leadScore(r: {
  impressions30: number;
  detailOpens30: number;
  directionsClicks30: number;
  intentVisits30: number;
  sales: number;
  reviews: number;
  favorites: number;
}): number {
  return Math.round(
    r.intentVisits30 * 8 +
      r.directionsClicks30 * 5 +
      r.detailOpens30 * 2 +
      r.impressions30 * 0.5 +
      r.sales * 3 +
      r.reviews * 2 +
      r.favorites * 2,
  );
}

export async function getLeads(
  opts: { region?: string; category?: string; limit?: number } = {},
): Promise<LeadRow[]> {
  const limit = opts.limit ?? 100;
  const where: Prisma.StoreWhereInput = {
    ownerId: null, // 미전환 = 사장님 미인증
    status: "active",
    ...(isCategory(opts.category) ? { category: opts.category } : {}),
    ...(opts.region?.trim() ? { address: { contains: opts.region.trim() } } : {}),
  };

  const stores = await prisma.store.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: CANDIDATE_CAP,
    select: {
      id: true,
      name: true,
      category: true,
      address: true,
      phone: true,
      createdAt: true,
      createdBy: { select: { nickname: true } },
    },
  });
  const ids = stores.map((s) => s.id);
  if (ids.length === 0) return [];

  const cutoff = kstDayString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [statRows, saleGroups, reviewGroups, favGroups, outreachRows] = await Promise.all([
    prisma.storeStatDaily.groupBy({
      by: ["storeId"],
      where: { storeId: { in: ids }, day: { gte: cutoff } },
      _sum: { impressions: true, detailOpens: true, directionsClicks: true, intentVisits: true },
    }),
    prisma.sale.groupBy({ by: ["storeId"], where: { storeId: { in: ids } }, _count: { _all: true } }),
    prisma.review.groupBy({
      by: ["storeId"],
      where: { storeId: { in: ids }, hidden: false, held: false },
      _count: { _all: true },
    }),
    prisma.favorite.groupBy({ by: ["storeId"], where: { storeId: { in: ids } }, _count: { _all: true } }),
    prisma.leadOutreach.findMany({ where: { storeId: { in: ids } } }),
  ]);

  const statMap = new Map(statRows.map((s) => [s.storeId, s._sum]));
  const saleMap = new Map(saleGroups.map((g) => [g.storeId, g._count._all]));
  const reviewMap = new Map(reviewGroups.map((g) => [g.storeId, g._count._all]));
  const favMap = new Map(favGroups.map((g) => [g.storeId, g._count._all]));
  const outreachMap = new Map(outreachRows.map((o) => [o.storeId, o]));

  const rows: LeadRow[] = stores.map((s) => {
    const st = statMap.get(s.id);
    const base = {
      impressions30: st?.impressions ?? 0,
      detailOpens30: st?.detailOpens ?? 0,
      directionsClicks30: st?.directionsClicks ?? 0,
      intentVisits30: st?.intentVisits ?? 0,
      sales: saleMap.get(s.id) ?? 0,
      reviews: reviewMap.get(s.id) ?? 0,
      favorites: favMap.get(s.id) ?? 0,
    };
    const o = outreachMap.get(s.id);
    return {
      id: s.id,
      name: s.name,
      category: s.category as Category,
      categoryLabel: CATEGORY_META[s.category as Category]?.label ?? s.category,
      address: s.address,
      phone: s.phone,
      createdAt: s.createdAt.toISOString(),
      registeredBy: s.createdBy.nickname,
      ...base,
      score: leadScore(base),
      outreachStatus: o?.status ?? "new",
      outreachNote: o?.note ?? null,
    };
  });

  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit);
}
