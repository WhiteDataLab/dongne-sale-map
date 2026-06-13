import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liveSponsorFilter } from "@/lib/sponsors";
import type { FeedSale, FeedReview } from "@/lib/types";

/**
 * 현 지도 영역(bounds)의 실시간 피드:
 * - sales: 최신 활성 세일 (지도 상단 광고판/마퀴용)
 * - reviews: 최신 리뷰 (유튜브 채팅처럼 올라가는 스트림용)
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
    // 현 영역 내 '노출 중' 스폰서 가게 id (M1-A) — 이 가게 세일은 마퀴 상단에 고정 노출.
    const sponsorRows = await prisma.sponsorship.findMany({
      where: { ...liveSponsorFilter(now), store: inBounds },
      select: { storeId: true },
    });
    const sponsorIds = new Set(sponsorRows.map((r) => r.storeId));

    const [saleRows, reviewRows] = await Promise.all([
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
        where: { hidden: false, store: inBounds },
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
      .sort((a, b) => Number(b.sponsored) - Number(a.sponsored));
    const reviews: FeedReview[] = reviewRows.map((r) => ({
      id: r.id,
      nickname: r.user.nickname,
      content: [...r.tags, r.content].filter((s) => s && s.trim()).join(", "),
      rating: r.rating,
      storeName: r.store.name,
    }));

    return NextResponse.json({ sales, reviews });
  } catch {
    return NextResponse.json({ sales: [], reviews: [] });
  }
}
