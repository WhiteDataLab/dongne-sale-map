import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageMenu, canManageStore } from "@/lib/menu";
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
        products: {
          where: { hidden: false }, // 신고 자동 숨김 제외 (Phase 7b)
          include: { createdBy: { select: { nickname: true, profileImgUrl: true } } },
          orderBy: { updatedAt: "desc" },
        },
        sales: {
          where: { status: "active", expiresAt: { gt: now } },
          orderBy: { createdAt: "desc" },
        },
        reviews: {
          where: { hidden: false }, // 자동 숨김된 리뷰 제외 (Phase 4)
          include: { user: { select: { nickname: true } } },
          orderBy: { createdAt: "desc" },
        },
        createdBy: { select: { nickname: true, profileImgUrl: true } },
        owner: { select: { nickname: true, profileImgUrl: true } },
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
    const user = await getCurrentUser();
    const userId = user?.id ?? null;
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
      hasOwner: Boolean(store.ownerId),
      isOwner: Boolean(userId && store.ownerId === userId),
      canManageMenu: canManageMenu(store, user),
      canManageStore: canManageStore(store, user),
      bannerUrl: store.bannerUrl,
      registeredBy: {
        nickname: store.createdBy.nickname,
        img: store.createdBy.profileImgUrl,
      },
      owner: store.owner
        ? { nickname: store.owner.nickname, img: store.owner.profileImgUrl }
        : null,
      products: store.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        qtyUnit: p.qtyUnit,
        stock: p.stock,
        photoUrl: p.photoUrl,
        origin: p.origin,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        contributorNickname: p.createdBy.nickname,
        contributorImg: p.createdBy.profileImgUrl,
      })),
      sales: store.sales.map((s) => ({
        id: s.id,
        title: s.title,
        photoUrl: s.photoUrl,
        photoUrls: s.photoUrls.length > 0 ? s.photoUrls : s.photoUrl ? [s.photoUrl] : [],
        salePrice: s.salePrice,
        qty: s.qty,
        expiresAt: s.expiresAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        isMine: Boolean(userId && s.createdById === userId),
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

/** 가게 정보 수정 (Phase 7c: 배너). 소유자(사장님)·관리자만. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let body: { bannerUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  try {
    const store = await prisma.store.findUnique({ where: { id } });
    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }
    if (!canManageStore(store, user)) {
      return NextResponse.json(
        { error: "사장님·관리자만 변경할 수 있어요." },
        { status: 403 },
      );
    }
    await prisma.store.update({ where: { id }, data: { bannerUrl: body.bannerUrl ?? null } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "변경에 실패했어요." }, { status: 500 });
  }
}
