import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { geocodeAddress } from "@/lib/kakaoLocal";
import { CATEGORIES, type Category } from "@/lib/constants";
import { asStoreHours, isOpenNow, kstTodayStart } from "@/lib/businessHours";
import type { StoreDTO, StoreSource } from "@/lib/types";

const SHUTDOWN_WINDOW_DAYS = 14; // 폐업 제보 노출 기간

/**
 * 현 지도 영역(bounds) 내 활성 가게 목록 (스펙 Phase 1).
 * 쿼리: swLat, swLng, neLat, neLng (필수) / category, onlySale (선택)
 *
 * DB 미연결·마이그레이션 전이어도 지도는 계속 동작해야 하므로,
 * 오류 시 빈 목록으로 graceful 처리한다(스펙 6장 empty state).
 */
export const runtime = "nodejs";

function isCategory(v: string | null): v is Category {
  return v !== null && (CATEGORIES as string[]).includes(v);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const swLat = Number(sp.get("swLat"));
  const swLng = Number(sp.get("swLng"));
  const neLat = Number(sp.get("neLat"));
  const neLng = Number(sp.get("neLng"));

  if (![swLat, swLng, neLat, neLng].every(Number.isFinite)) {
    return NextResponse.json(
      { error: "지도 영역(bounds) 파라미터가 필요해요.", stores: [] },
      { status: 400 },
    );
  }

  const categoryParam = sp.get("category");
  const category = isCategory(categoryParam) ? categoryParam : undefined;
  const onlySale = sp.get("onlySale") === "1";

  try {
    const now = new Date();
    const rows = await prisma.store.findMany({
      where: {
        status: "active",
        lat: { gte: swLat, lte: neLat },
        lng: { gte: swLng, lte: neLng },
        ...(category ? { category } : {}),
      },
      select: {
        id: true,
        name: true,
        category: true,
        lat: true,
        lng: true,
        address: true,
        verified: true,
        source: true,
        hoursJson: true,
        sales: {
          where: { status: "active", expiresAt: { gt: now } },
          select: { salePrice: true, expiresAt: true },
        },
      },
      take: 200,
    });

    // 마감 임박 기준: 1시간 이내 만료
    const soonThreshold = new Date(now.getTime() + 60 * 60 * 1000);

    // 휴업/폐업 제보 집계: 오늘 휴업 + 최근 폐업 (대상 = 화면 내 가게)
    const ids = rows.map((s) => s.id);
    const closedToday = new Map<string, number>();
    const shutdown = new Map<string, number>();
    if (ids.length > 0) {
      const shutdownSince = new Date(Date.now() - SHUTDOWN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const [ct, sd] = await Promise.all([
        prisma.closureReport.groupBy({
          by: ["storeId"],
          where: { storeId: { in: ids }, kind: "closed_today", createdAt: { gte: kstTodayStart() } },
          _count: true,
        }),
        prisma.closureReport.groupBy({
          by: ["storeId"],
          where: { storeId: { in: ids }, kind: "shutdown", createdAt: { gte: shutdownSince } },
          _count: true,
        }),
      ]);
      for (const g of ct) closedToday.set(g.storeId, g._count);
      for (const g of sd) shutdown.set(g.storeId, g._count);
    }

    let stores: StoreDTO[] = rows.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category as Category,
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      verified: s.verified,
      source: s.source as StoreSource,
      hasActiveSale: s.sales.length > 0,
      saleMinPrice: s.sales.length > 0 ? Math.min(...s.sales.map((x) => x.salePrice)) : null,
      saleSoonExpiring: s.sales.some((x) => x.expiresAt <= soonThreshold),
      isOpenNow: isOpenNow(asStoreHours(s.hoursJson), now),
      closedTodayReports: closedToday.get(s.id) ?? 0,
      shutdownReports: shutdown.get(s.id) ?? 0,
    }));

    if (onlySale) stores = stores.filter((s) => s.hasActiveSale);

    return NextResponse.json({ stores });
  } catch {
    // DB 미연결/스키마 미적용 → 빈 결과 (지도는 계속 동작)
    return NextResponse.json({ stores: [], dbUnavailable: true });
  }
}

/**
 * 가게 등록 (스펙 Phase 6, 소비자).
 * 주소를 지오코딩해 좌표를 얻고 미인증(verified=false, source=user)으로 생성.
 * 관리자 승인은 /admin/stores. 사장님 직접 등록/인증은 후속 단계.
 */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

type CreateBody = {
  name?: string;
  category?: string;
  address?: string;
  phone?: string;
  description?: string;
  lat?: number; // 지도에서 직접 찍은 좌표 (있으면 지오코딩 생략)
  lng?: number;
};

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const name = body.name?.trim();
  const address = body.address?.trim();
  const category = isCategory(body.category ?? null) ? (body.category as Category) : null;
  if (!name || !address || !category) {
    return NextResponse.json(
      { error: "가게명·카테고리·주소는 필수예요." },
      { status: 400 },
    );
  }
  if (name.length > 100 || address.length > 200) {
    return NextResponse.json({ error: "가게명·주소가 너무 길어요." }, { status: 400 });
  }

  try {
    const recent = await prisma.store.count({
      where: { createdById: userId, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
    });
    if (recent >= RATE_MAX) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해 주세요. (너무 많은 등록)" },
        { status: 429 },
      );
    }

    // 좌표: 지도에서 직접 찍었으면 그대로, 아니면 주소 지오코딩
    let lat: number;
    let lng: number;
    if (
      typeof body.lat === "number" &&
      typeof body.lng === "number" &&
      Number.isFinite(body.lat) &&
      Number.isFinite(body.lng)
    ) {
      lat = body.lat;
      lng = body.lng;
    } else {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return NextResponse.json(
          { error: "주소의 위치를 찾을 수 없어요. 주소를 확인하거나 지도에서 선택해 주세요." },
          { status: 422 },
        );
      }
      lat = geo.lat;
      lng = geo.lng;
    }

    const store = await prisma.store.create({
      data: {
        name,
        category,
        address,
        lat,
        lng,
        phone: body.phone?.trim().slice(0, 40) || null,
        description: body.description?.trim().slice(0, 2000) || null,
        verified: false,
        source: "user",
        createdById: userId,
      },
    });

    return NextResponse.json({ ok: true, storeId: store.id, lat, lng });
  } catch {
    return NextResponse.json({ error: "가게 등록에 실패했어요." }, { status: 500 });
  }
}
