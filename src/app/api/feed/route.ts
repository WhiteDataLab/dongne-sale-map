import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liveSponsorFilter, regionFromAddress } from "@/lib/sponsors";
import { getProStoreIds } from "@/lib/pro";
import { getLocalAdsForRegions } from "@/lib/localAds";
import { kstTodayStart } from "@/lib/businessHours";
import { getLaunchFlags } from "@/lib/launchFlags";
import type { FeedSale, FeedReview, FeedCounts } from "@/lib/types";

/**
 * 현 지도 영역(bounds)의 실시간 피드:
 * - sales: 최신 활성 세일 (지도 상단 광고판/마퀴용)
 * - reviews: 최신 리뷰 (유튜브 채팅처럼 올라가는 스트림용)
 * - counts: 라이브 카운터 헤드라인용 집계 (오늘 제보 N건·마감임박 M곳 — 러브버그맵 패턴,
 *   THEME_MAP_BENCHMARK_PM_BRIEF P0-3)
 * 줌아웃할수록 bounds 가 넓어져 더 많은 데이터가 들어온다.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const swLat = Number(sp.get("swLat"));
  const swLng = Number(sp.get("swLng"));
  const neLat = Number(sp.get("neLat"));
  const neLng = Number(sp.get("neLng"));
  if (![swLat, swLng, neLat, neLng].every(Number.isFinite)) {
    return NextResponse.json({ sales: [], reviews: [] });
  }

  const inBounds = {
    status: "active" as const,
    lat: { gte: swLat, lte: neLat },
    lng: { gte: swLng, lte: neLng },
  };

  try {
    const now = new Date();
    // P1-11 광고 절제 모드: 켜져 있으면(기본) 소비자 피드에서 스폰서 고정·로컬 광고를 뺀다(신뢰 우선).
    const { adRestraint } = await getLaunchFlags();
    // 현 영역 내 '노출 중' 스폰서 가게 id (M1-A) — 이 가게 세일은 마퀴 상단에 고정 노출.
    const sponsorRows = adRestraint
      ? []
      : await prisma.sponsorship.findMany({
          where: { ...liveSponsorFilter(now), store: inBounds },
          select: { storeId: true },
        });
    const sponsorIds = new Set(sponsorRows.map((r) => r.storeId));
    // M4: 프로 플랜 가게는 스폰서 중에서도 더 위로(상위 노출).
    const proIds = await getProStoreIds([...sponsorIds], now);

    const soonCutoff = new Date(now.getTime() + 60 * 60 * 1000);
    const [saleRows, reviewRows, activeSaleCount, soonCount, todayReportCount] = await Promise.all([
      prisma.sale.findMany({
        where: { status: "active", expiresAt: { gt: now }, store: inBounds },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          storeId: true,
          title: true,
          salePrice: true,
          qty: true,
          createdAt: true,
          store: { select: { name: true } },
        },
      }),
      prisma.review.findMany({
        where: { hidden: false, held: false, store: inBounds },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          content: true,
          tags: true,
          rating: true,
          user: { select: { nickname: true } },
          store: { select: { name: true } },
        },
      }),
      // 라이브 카운터: 현 영역 활성 세일 / 1시간 내 마감 / 오늘(KST) 새 제보
      prisma.sale.count({ where: { status: "active", expiresAt: { gt: now }, store: inBounds } }),
      prisma.sale.count({
        where: { status: "active", expiresAt: { gt: now, lt: soonCutoff }, store: inBounds },
      }),
      prisma.sale.count({ where: { createdAt: { gte: kstTodayStart() }, store: inBounds } }),
    ]);

    // 스폰서 가게의 활성 세일이 최신 15개에 안 들었을 수 있으니 별도로 끌어와 합친다(중복 제거).
    let merged = saleRows;
    const missingSponsorIds = [...sponsorIds].filter((id) => !saleRows.some((s) => s.storeId === id));
    if (missingSponsorIds.length > 0) {
      const sponsorSales = await prisma.sale.findMany({
        where: { status: "active", expiresAt: { gt: now }, storeId: { in: missingSponsorIds } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          storeId: true,
          title: true,
          salePrice: true,
          qty: true,
          createdAt: true,
          store: { select: { name: true } },
        },
      });
      merged = [...sponsorSales, ...saleRows];
    }

    // 스폰서 세일을 앞으로(고정), 나머지는 최신순 유지.
    const sales: FeedSale[] = merged
      .map((s) => ({
        id: s.id,
        storeId: s.storeId,
        title: s.title,
        salePrice: s.salePrice,
        qty: s.qty,
        storeName: s.store.name,
        createdAt: s.createdAt.toISOString(),
        sponsored: sponsorIds.has(s.storeId),
      }))
      .sort(
        (a, b) =>
          Number(proIds.has(b.storeId)) - Number(proIds.has(a.storeId)) ||
          Number(b.sponsored) - Number(a.sponsored),
      );
    const reviews: FeedReview[] = reviewRows.map((r) => ({
      id: r.id,
      nickname: r.user.nickname,
      content: [...r.tags, r.content].filter((s) => s && s.trim()).join(", "),
      rating: r.rating,
      storeName: r.store.name,
    }));

    // L4: 현 지도에 보이는 가게들의 동(region) 으로 로컬 광고 타게팅(GPS 미수집 — 보이는 가게 주소 기반).
    const inViewStores = await prisma.store.findMany({
      where: inBounds,
      select: { address: true },
      take: 200,
    });
    const regions = [...new Set(inViewStores.map((s) => regionFromAddress(s.address)).filter((r) => r !== "구독"))];
    const localAds = adRestraint ? [] : await getLocalAdsForRegions(regions, now);

    // 헤드라인용 동네 이름: 보이는 가게 주소에서 가장 흔한 동(洞). 없으면 '우리 동네'.
    const regionCount = new Map<string, number>();
    for (const s of inViewStores) {
      const r = regionFromAddress(s.address);
      if (r === "구독") continue;
      regionCount.set(r, (regionCount.get(r) ?? 0) + 1);
    }
    const topRegion =
      [...regionCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "우리 동네";
    const counts: FeedCounts = {
      region: topRegion,
      activeSales: activeSaleCount,
      soonExpiring: soonCount,
      todayReports: todayReportCount,
    };

    return NextResponse.json({ sales, reviews, localAds, counts });
  } catch {
    return NextResponse.json({ sales: [], reviews: [] });
  }
}
