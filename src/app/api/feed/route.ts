import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    const sales: FeedSale[] = saleRows.map((s) => ({
      id: s.id,
      storeId: s.storeId,
      title: s.title,
      salePrice: s.salePrice,
      qty: s.qty,
      storeName: s.store.name,
      createdAt: s.createdAt.toISOString(),
    }));
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
