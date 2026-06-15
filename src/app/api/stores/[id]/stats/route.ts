import { NextRequest, NextResponse } from "next/server";
import type { StoreCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import { kstDayString } from "@/lib/events";
import { isStorePro } from "@/lib/pro";
import { regionFromAddress } from "@/lib/sponsors";

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

/**
 * 동종업종 벤치마크: 같은 동(region) + 같은 업종의 다른 가게들과 최근 30일 노출/상세/방문의향을 비교.
 * 하이퍼로컬 특성상 동·업종당 가게 수가 적어 peer 60곳 상한이면 충분. peer 0곳이면 null(데이터 부족).
 */
async function buildBenchmark(
  storeId: string,
  category: StoreCategory,
  region: string,
  mine: Totals,
  days: string[],
) {
  const peers = await prisma.store.findMany({
    where: {
      status: "active",
      category,
      address: { contains: region },
      id: { not: storeId },
    },
    select: { id: true },
    take: 60,
  });
  if (peers.length === 0) return null;
  const peerIds = peers.map((p) => p.id);

  const grouped = await prisma.storeStatDaily.groupBy({
    by: ["storeId"],
    where: { storeId: { in: peerIds }, day: { in: days } },
    _sum: { impressions: true, detailOpens: true, intentVisits: true },
  });
  const byStore = new Map(grouped.map((g) => [g.storeId, g._sum]));

  let sumImpr = 0;
  let sumDetail = 0;
  let sumIntent = 0;
  let beatImpr = 0; // 내가 노출에서 앞선 peer 수
  for (const pid of peerIds) {
    const s = byStore.get(pid);
    const impr = s?.impressions ?? 0;
    sumImpr += impr;
    sumDetail += s?.detailOpens ?? 0;
    sumIntent += s?.intentVisits ?? 0;
    if (mine.impressions > impr) beatImpr += 1;
  }
  const n = peerIds.length;
  return {
    region,
    peerCount: n,
    avg: {
      impressions: Math.round(sumImpr / n),
      detailOpens: Math.round(sumDetail / n),
      intentVisits: Math.round((sumIntent / n) * 10) / 10,
    },
    mine: { impressions: mine.impressions, detailOpens: mine.detailOpens, intentVisits: mine.intentVisits },
    percentile: Math.round((beatImpr / n) * 100), // 노출 기준 상위 백분위(동종 중 내가 앞선 비율)
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const store = await prisma.store.findUnique({
    where: { id },
    select: { ownerId: true, category: true, address: true },
  });
  if (!store) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!canManageStore(store, user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // M4: 프로 플랜이면 30·90일 추이 + 요일별 분석까지 확장 제공.
  const pro = await isStorePro(id);
  const DAY = 24 * 60 * 60 * 1000;
  const span = pro ? 90 : 7;
  const today = kstDayString();
  const dayList: string[] = [];
  for (let i = 0; i < span; i++) dayList.push(kstDayString(new Date(Date.now() - i * DAY)));
  const last7Set = new Set(dayList.slice(0, 7));
  const last30Set = new Set(dayList.slice(0, 30));

  const rows = await prisma.storeStatDaily.findMany({
    where: { storeId: id, day: { in: dayList } },
  });

  const add = (acc: Totals, r: (typeof rows)[number]): Totals => ({
    impressions: acc.impressions + r.impressions,
    detailOpens: acc.detailOpens + r.detailOpens,
    directionsClicks: acc.directionsClicks + r.directionsClicks,
    favorites: acc.favorites + r.favorites,
    shares: acc.shares + r.shares,
    intentVisits: acc.intentVisits + r.intentVisits,
  });

  const last7 = rows.filter((r) => last7Set.has(r.day)).reduce(add, { ...ZERO });
  const todayRow = rows.find((r) => r.day === today);
  const todayTotals = todayRow ? add({ ...ZERO }, todayRow) : { ...ZERO };

  if (!pro) {
    return NextResponse.json({ today: todayTotals, last7, pro: false });
  }

  // 프로 확장: 30/90일 합계 + 최근 30일 일별 추이 + 요일별(노출/상세) 분석.
  const last30 = rows.filter((r) => last30Set.has(r.day)).reduce(add, { ...ZERO });
  const last90 = rows.reduce(add, { ...ZERO });

  const byDay = new Map(rows.map((r) => [r.day, r]));
  const daily = dayList
    .slice(0, 30)
    .reverse()
    .map((day) => {
      const r = byDay.get(day);
      return { day, impressions: r?.impressions ?? 0, detailOpens: r?.detailOpens ?? 0 };
    });

  // 요일별(0=일~6=토) 노출/상세 합계 — KST 기준.
  const weekday = Array.from({ length: 7 }, () => ({ impressions: 0, detailOpens: 0 }));
  for (const r of rows) {
    const dow = new Date(`${r.day}T00:00:00+09:00`).getDay();
    weekday[dow].impressions += r.impressions;
    weekday[dow].detailOpens += r.detailOpens;
  }

  // M11: 동종업종 벤치마크 — 같은 동(洞) + 같은 업종 가게들의 최근 30일 평균과 비교.
  const region = regionFromAddress(store.address);
  const last30Days = dayList.slice(0, 30);
  const benchmark = await buildBenchmark(id, store.category, region, last30, last30Days);

  return NextResponse.json({ today: todayTotals, last7, pro: true, last30, last90, daily, weekday, benchmark });
}
