import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { kstDayString, type IncomingEvent } from "@/lib/events";

/**
 * L3(수익화) — 성과형 광고(CPA).
 * 정액 구독 대신 '결과당 과금': 방문의향(갈래요)·길찾기 1건당 입찰가만큼 예산을 차감한다.
 * 과금 근거는 M0 이벤트. 어뷰징 방어는 (campaignId, sessionId, day) 1회 과금 + 자가클릭 제외.
 */

export const BILLABLE_ACTIONS = ["intent_visit", "directions_click"] as const;
export type BillableAction = (typeof BILLABLE_ACTIONS)[number];

export const ACTION_LABEL: Record<BillableAction, string> = {
  intent_visit: "갈래요(방문의향)",
  directions_click: "길찾기",
};

export const AD_MIN_BID = 100;
export const AD_MAX_BID = 2000;
export const AD_MIN_BUDGET = 5000;
export const AD_MAX_BUDGET = 1_000_000;

export function isBillableAction(v: unknown): v is BillableAction {
  return typeof v === "string" && (BILLABLE_ACTIONS as readonly string[]).includes(v);
}

/**
 * 들어온 이벤트 배치에 대해 CPA 과금을 누적한다(best-effort).
 * - 과금 대상: 활성 캠페인이 있는 (storeId, action) 의 billable 이벤트.
 * - 1회 과금: (campaignId, sessionId, day) 유니크로 같은 세션이 같은 날 예산을 드레인하지 못하게.
 * - 자가 클릭 제외: 이벤트 userId == 캠페인 소유자면 과금 안 함.
 * - 예산 소진 시 status=depleted.
 */
export async function accrueCpa(
  events: IncomingEvent[],
  ctx: { userId: string | null; sessionId: string },
): Promise<void> {
  // billable (storeId, action) 쌍을 유니크하게(같은 배치 중복 제거)
  const pairs = new Map<string, { storeId: string; action: BillableAction }>();
  for (const e of events) {
    if (isBillableAction(e.type)) pairs.set(`${e.storeId}:${e.type}`, { storeId: e.storeId, action: e.type });
  }
  if (pairs.size === 0) return;

  const storeIds = [...new Set([...pairs.values()].map((p) => p.storeId))];
  const campaigns = await prisma.adCampaign.findMany({
    where: { status: "active", storeId: { in: storeIds } },
    select: { id: true, storeId: true, userId: true, action: true, bidKrw: true, budgetKrw: true, spentKrw: true, dailyCapKrw: true },
  });
  if (campaigns.length === 0) return;

  const day = kstDayString();
  const sid = ctx.sessionId.slice(0, 64);

  for (const c of campaigns) {
    // 이 캠페인 action 의 billable 이벤트가 배치에 있나
    if (!pairs.has(`${c.storeId}:${c.action}`)) continue;
    // 자가 클릭 제외
    if (ctx.userId && ctx.userId === c.userId) continue;
    // 예산 소진 방어(스냅샷 기준 1차)
    if (c.spentKrw >= c.budgetKrw) continue;
    // 일 상한(설정 시)
    if (c.dailyCapKrw != null) {
      const todaySpent = await prisma.adCharge.aggregate({
        where: { campaignId: c.id, day },
        _sum: { amountKrw: true },
      });
      if ((todaySpent._sum.amountKrw ?? 0) >= c.dailyCapKrw) continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // (campaignId, sessionId, day) 유니크 — 충돌 시 P2002 → 오늘 이 세션은 이미 과금됨
        await tx.adCharge.create({
          data: {
            campaignId: c.id,
            storeId: c.storeId,
            sessionId: sid,
            userId: ctx.userId,
            action: c.action,
            amountKrw: c.bidKrw,
            day,
          },
        });
        const updated = await tx.adCampaign.update({
          where: { id: c.id },
          data: { spentKrw: { increment: c.bidKrw }, chargedCount: { increment: 1 } },
          select: { spentKrw: true, budgetKrw: true },
        });
        if (updated.spentKrw >= updated.budgetKrw) {
          await tx.adCampaign.update({ where: { id: c.id }, data: { status: "depleted" } });
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // 중복 과금 방지(정상)
      // 그 외 오류는 무시(베스트에포트 — 사용자 경험 막지 않음)
    }
  }
}

export type AdCampaignDTO = {
  id: string;
  action: BillableAction;
  actionLabel: string;
  bidKrw: number;
  budgetKrw: number;
  spentKrw: number;
  remainingKrw: number;
  chargedCount: number;
  dailyCapKrw: number | null;
  status: "active" | "paused" | "depleted" | "canceled";
  createdAt: string;
};

/** 가게의 현재(종료되지 않은) 캠페인. 없으면 null. */
export async function getActiveAdCampaign(storeId: string): Promise<AdCampaignDTO | null> {
  const c = await prisma.adCampaign.findFirst({
    where: { storeId, status: { in: ["active", "paused", "depleted"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!c) return null;
  return {
    id: c.id,
    action: c.action as BillableAction,
    actionLabel: ACTION_LABEL[c.action as BillableAction] ?? c.action,
    bidKrw: c.bidKrw,
    budgetKrw: c.budgetKrw,
    spentKrw: c.spentKrw,
    remainingKrw: Math.max(0, c.budgetKrw - c.spentKrw),
    chargedCount: c.chargedCount,
    dailyCapKrw: c.dailyCapKrw,
    status: c.status as AdCampaignDTO["status"],
    createdAt: c.createdAt.toISOString(),
  };
}
