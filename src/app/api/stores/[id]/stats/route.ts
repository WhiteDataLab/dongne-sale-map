import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import { kstDayString } from "@/lib/events";

/**
 * M0(수익화) — 사장님 노출 리포트.
 * 자기 가게의 오늘/최근 7일 노출·상세열람·길찾기·즐겨찾기·공유·방문의향 수를 반환.
 * **owner/admin 전용**(canManageStore 재사용). 광고/구독 과금의 근거 화면.
 */
export const runtime = "nodejs";

type Totals = {
  impressions: number;
  detailOpens: number;
  directionsClicks: number;
  favorites: number;
  shares: number;
  intentVisits: number;
};
const ZERO: Totals = {
  impressions: 0,
  detailOpens: 0,
  directionsClicks: 0,
  favorites: 0,
  shares: 0,
  intentVisits: 0,
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const store = await prisma.store.findUnique({ where: { id }, select: { ownerId: true } });
  if (!store) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!canManageStore(store, user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const today = kstDayString();
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(kstDayString(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  }

  const rows = await prisma.storeStatDaily.findMany({
    where: { storeId: id, day: { in: days } },
  });

  const add = (acc: Totals, r: (typeof rows)[number]): Totals => ({
    impressions: acc.impressions + r.impressions,
    detailOpens: acc.detailOpens + r.detailOpens,
    directionsClicks: acc.directionsClicks + r.directionsClicks,
    favorites: acc.favorites + r.favorites,
    shares: acc.shares + r.shares,
    intentVisits: acc.intentVisits + r.intentVisits,
  });

  const last7 = rows.reduce(add, { ...ZERO });
  const todayRow = rows.find((r) => r.day === today);
  const todayTotals = todayRow ? add({ ...ZERO }, todayRow) : { ...ZERO };

  return NextResponse.json({ today: todayTotals, last7 });
}
