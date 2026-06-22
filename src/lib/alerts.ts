import { prisma } from "@/lib/prisma";
import type { StoreTier } from "@/lib/pro";

/**
 * M9(수익화) — 세일/소식 알림 발송 헬퍼.
 * 사장님(라이트+)이 즐겨찾기 손님에게 알림을 발송한다. 푸시/문자는 Out-of-scope·목업이라
 * 1차 도달은 인앱 알림함(/notifications). 팬아웃 없이 StoreAlert 1행만 저장하고,
 * 각 사용자 알림함은 (StoreAlert ⋈ 내 Favorite, 팔로우 이후·조회 윈도우 내) 조인으로 파생한다.
 */

/** 라이트 월 발송 한도(프로는 무제한). */
export const LITE_ALERT_MONTHLY_LIMIT = 4;
/** 알림함 조회 윈도우(일). 이보다 오래된 알림은 노출 안 함. */
export const ALERT_WINDOW_DAYS = 30;
/** 가게당 1일 발송 상한(도배 방지). */
export const ALERT_DAILY_LIMIT = 5;

export const ALERT_TITLE_MAX = 60;
export const ALERT_BODY_MAX = 200;

/** KST(UTC+9) 이번 달 1일 자정을 UTC Date 로. (createdAt 은 UTC 저장) */
export function kstMonthStart(now: Date = new Date()): Date {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const startKstAsUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1);
  return new Date(startKstAsUtc - 9 * 60 * 60 * 1000);
}

/** 이번 달(KST) 가게가 발송한 알림 수. */
export async function alertsSentThisMonth(storeId: string, now: Date = new Date()): Promise<number> {
  return prisma.storeAlert.count({
    where: { storeId, createdAt: { gte: kstMonthStart(now) } },
  });
}

/** 티어별 이번 달 남은 발송 횟수(프로=Infinity). monthlyLimit 미지정 시 기본 상수. */
export function remainingAlerts(
  tier: StoreTier,
  sentThisMonth: number,
  monthlyLimit: number = LITE_ALERT_MONTHLY_LIMIT,
): number {
  if (tier === "pro") return Infinity;
  if (tier === "lite") return Math.max(0, monthlyLimit - sentThisMonth);
  return 0;
}

/** 사장님 관리 화면용 발송 이력(최근). */
export type StoreAlertRow = {
  id: string;
  kind: "sale" | "notice";
  title: string;
  body: string;
  createdAt: string;
};

export async function getStoreAlerts(storeId: string, take = 20): Promise<StoreAlertRow[]> {
  const rows = await prisma.storeAlert.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, kind: true, title: true, body: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as "sale" | "notice",
    title: r.title,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** 소비자 알림함 항목(내 즐겨찾기 가게의 알림). */
export type MyStoreAlert = {
  id: string;
  storeId: string;
  storeName: string;
  kind: "sale" | "notice";
  title: string;
  body: string;
  createdAt: string;
};

/**
 * 내가 즐겨찾기한 가게들의 알림(팔로우 시점 이후·조회 윈도우 내).
 * 팬아웃 없음: 즐겨찾기 가게의 최근 알림을 한 번에 조회 후, 가게별 favoritedAt 으로 필터한다.
 */
export async function getMyStoreAlerts(userId: string, now: Date = new Date()): Promise<MyStoreAlert[]> {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    select: { storeId: true, createdAt: true },
  });
  if (favorites.length === 0) return [];

  const favAt = new Map(favorites.map((f) => [f.storeId, f.createdAt]));
  const windowStart = new Date(now.getTime() - ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const alerts = await prisma.storeAlert.findMany({
    where: { storeId: { in: [...favAt.keys()] }, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      storeId: true,
      kind: true,
      title: true,
      body: true,
      createdAt: true,
      store: { select: { name: true } },
    },
  });

  return alerts
    .filter((a) => {
      const at = favAt.get(a.storeId);
      return at != null && a.createdAt >= at; // 팔로우 이후 알림만
    })
    .map((a) => ({
      id: a.id,
      storeId: a.storeId,
      storeName: a.store.name,
      kind: a.kind as "sale" | "notice",
      title: a.title,
      body: a.body,
      createdAt: a.createdAt.toISOString(),
    }));
}
