import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPublicStorageUrl, deletePublicImage } from "@/lib/supabaseStorage";
import { getCurrentUser } from "@/lib/session";
import { canManageMenu, canManageStore } from "@/lib/menu";
import { asStoreHours, isOpenNow, kstTodayStart } from "@/lib/businessHours";
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
          include: {
            user: { select: { nickname: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        createdBy: { select: { nickname: true, profileImgUrl: true } },
        owner: { select: { nickname: true, profileImgUrl: true } },
        closureReports: {
          where: {
            OR: [
              { kind: "closed_today", createdAt: { gte: kstTodayStart() } },
              { kind: "shutdown", createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
            ],
          },
          include: { createdBy: { select: { nickname: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }

    // 별점 평균은 '반영 대상(scored)' 리뷰만 집계 (같은 날 재작성 등은 제외)
    const ratings = store.reviews.filter((r) => r.scored).map((r) => r.rating);
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

    // 리뷰에 연결된 구매 메뉴 이름 해석(현재 존재하는 상품만)
    const reviewProductIds = Array.from(new Set(store.reviews.flatMap((r) => r.productIds)));
    const productNameMap = new Map<string, string>();
    if (reviewProductIds.length > 0) {
      const prods = await prisma.product.findMany({
        where: { id: { in: reviewProductIds } },
        select: { id: true, name: true },
      });
      for (const p of prods) productNameMap.set(p.id, p.name);
    }

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
      notice: store.notice,
      hours,
      isOpenNow: isOpenNow(hours, now),
      hasActiveSale: store.sales.length > 0,
      saleMinPrice: store.sales.length > 0 ? Math.min(...store.sales.map((x) => x.salePrice)) : null,
      saleSoonExpiring: store.sales.some((x) => x.expiresAt <= new Date(now.getTime() + 60 * 60 * 1000)),
      saleSoonestExpiry:
        store.sales.length > 0
          ? new Date(Math.min(...store.sales.map((x) => x.expiresAt.getTime()))).toISOString()
          : null,
      saleLatestCreated:
        store.sales.length > 0
          ? new Date(Math.max(...store.sales.map((x) => x.createdAt.getTime()))).toISOString()
          : null,
      closedTodayReports: store.closureReports.filter((c) => c.kind === "closed_today").length,
      shutdownReports: store.closureReports.filter((c) => c.kind === "shutdown").length,
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
        tags: r.tags,
        products: r.productIds
          .filter((pid) => productNameMap.has(pid))
          .map((pid) => ({ id: pid, name: productNameMap.get(pid) as string })),
        photoUrls: r.photoUrls,
        receiptVerified: Boolean(r.receiptUrl),
        nickname: r.user.nickname,
        createdAt: r.createdAt.toISOString(),
        scored: r.scored,
        isMine: Boolean(userId && r.userId === userId),
      })),
      closureReports: store.closureReports.map((c) => ({
        id: c.id,
        kind: c.kind as "closed_today" | "shutdown",
        photoUrl: c.photoUrl,
        note: c.note,
        nickname: c.createdBy.nickname,
        createdAt: c.createdAt.toISOString(),
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

  let body: {
    bannerUrl?: string | null;
    notice?: string | null;
    description?: string | null;
    address?: string;
    phone?: string | null;
    hoursJson?: unknown;
  };
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
    // 전달된 필드만 부분 수정 (배너 / 공지 / 소개 / 기본정보 / 영업시간)
    const data: Prisma.StoreUpdateInput = {};
    if ("bannerUrl" in body) {
      const b = body.bannerUrl;
      if (b && !isPublicStorageUrl(b)) {
        return NextResponse.json({ error: "이미지 주소가 올바르지 않아요." }, { status: 400 });
      }
      data.bannerUrl = b ?? null;
    }
    if ("notice" in body) {
      const n = typeof body.notice === "string" ? body.notice.trim().slice(0, 2000) : "";
      data.notice = n || null; // 빈 문자열 = 삭제
    }
    if ("description" in body) {
      const d = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
      data.description = d || null;
    }
    if ("address" in body) {
      const a = typeof body.address === "string" ? body.address.trim().slice(0, 200) : "";
      if (!a) return NextResponse.json({ error: "주소를 입력해 주세요." }, { status: 400 });
      data.address = a;
    }
    if ("phone" in body) {
      const p = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
      data.phone = p || null;
    }
    if ("hoursJson" in body) {
      // null = 영업시간 정보 없음
      const h = asStoreHours(body.hoursJson);
      data.hoursJson = h === null ? Prisma.JsonNull : h;
    }
    await prisma.store.update({ where: { id }, data });
    // 배너가 바뀌었으면 이전 배너 이미지 정리(용량 절약)
    if ("bannerUrl" in body && store.bannerUrl && store.bannerUrl !== (body.bannerUrl ?? null)) {
      await deletePublicImage(store.bannerUrl);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "변경에 실패했어요." }, { status: 500 });
  }
}
