import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { asStoreHours, isOpenNow } from "@/lib/businessHours";
import type { Category } from "@/lib/constants";
import type { StoreDetailDTO, StoreSource } from "@/lib/types";

/** 가게 상세 (스펙 Phase 2): 상품/세일/리뷰 + 영업중 자동판정 + 즐겨찾기 여부. */
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  try {
    const now = new Date();
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        products: { orderBy: { createdAt: "desc" } },
        sales: {
          where: { status: "active", expiresAt: { gt: now } },
          orderBy: { createdAt: "desc" },
        },
        reviews: {
          where: { hidden: false }, // 자동 숨김된 리뷰 제외 (Phase 4)
          include: { user: { select: { nickname: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }

    const ratings = store.reviews.map((r) => r.rating);
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

    const hours = asStoreHours(store.hoursJson);

    // 즐겨찾기 여부: 로그인 사용자의 Favorite 존재 여부.
    const userId = await getCurrentUserId();
    const isFavorite = userId
      ? Boolean(
          await prisma.favorite.findUnique({
            where: { userId_storeId: { userId, storeId: id } },
          }),
        )
      : false;

    const dto: StoreDetailDTO = {
      id: store.id,
      name: store.name,
      category: store.category as Category,
      lat: store.lat,
      lng: store.lng,
      address: store.address,
      verified: store.verified,
      source: store.source as StoreSource,
      phone: store.phone,
      description: store.description,
      hours,
      isOpenNow: isOpenNow(hours, now),
      hasActiveSale: store.sales.length > 0,
      avgRating,
      reviewCount: store.reviews.length,
      isFavorite,
      products: store.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        qtyUnit: p.qtyUnit,
        stock: p.stock,
        photoUrl: p.photoUrl,
        origin: p.origin,
        createdAt: p.createdAt.toISOString(),
      })),
      sales: store.sales.map((s) => ({
        id: s.id,
        title: s.title,
        photoUrl: s.photoUrl,
        salePrice: s.salePrice,
        qty: s.qty,
        expiresAt: s.expiresAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
      reviews: store.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        content: r.content,
        nickname: r.user.nickname,
        createdAt: r.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(dto);
  } catch {
    return NextResponse.json(
      { error: "상세 정보를 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
