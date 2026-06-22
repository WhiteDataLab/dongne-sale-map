import { prisma } from "@/lib/prisma";

/**
 * M10(수익화) — 단골(Regular) CRM 헬퍼.
 * '단골'은 신규 테이블 없이 기존 신호(StoreEvent·Review·CouponClaim)로 파생 점수화한다.
 * 소비자 식별은 로그인 userId 기준(비로그인 익명 이벤트는 제외 — 개인정보 최소화).
 * 사장님에게는 닉네임·활동 신호만 노출(연락처/전화 미노출).
 */

/** 식별 기간(일). 이보다 오래 활동 없으면 목록에서 제외. */
export const REGULAR_LOOKBACK_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 최근성 가중: 최근 28일 활동은 ×1.5. */
const RECENCY_DAYS = 28;
const RECENCY_BOOST = 1.5;

/** 신호별 가중치(§10). */
const W = { usedCoupon: 5, review: 4, intentVisit: 3, directions: 2, detailOpen: 1 } as const;

export type RegularSegment = "active" | "at_risk" | "dormant";

export type RegularRow = {
  userId: string;
  nickname: string;
  img: string | null;
  score: number;
  segment: RegularSegment;
  lastActivityAt: string; // ISO
  signals: { usedCoupons: number; reviews: number; intentVisits: number; directions: number; detailOpens: number };
};

/** 마지막 활동일로 세그먼트 판정. */
export function segmentFor(lastActivityAt: Date, now: Date = new Date()): RegularSegment {
  const days = (now.getTime() - lastActivityAt.getTime()) / DAY_MS;
  if (days <= 30) return "active";
  if (days <= 90) return "at_risk";
  return "dormant";
}

type Agg = {
  score: number;
  last: Date;
  signals: RegularRow["signals"];
};

/** 단골 목록(점수순). segment 필터 옵션. */
export async function getRegulars(
  storeId: string,
  opts: { segment?: RegularSegment | "all"; now?: Date } = {},
): Promise<RegularRow[]> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - REGULAR_LOOKBACK_DAYS * DAY_MS);
  const recencyCut = now.getTime() - RECENCY_DAYS * DAY_MS;

  const [events, reviews, usedClaims] = await Promise.all([
    prisma.storeEvent.findMany({
      where: {
        storeId,
        userId: { not: null },
        createdAt: { gte: since },
        eventType: { in: ["intent_visit", "directions_click", "detail_open"] },
      },
      select: { userId: true, eventType: true, createdAt: true },
      take: 8000,
    }),
    prisma.review.findMany({
      where: { storeId, hidden: false, held: false, createdAt: { gte: since } },
      select: { userId: true, createdAt: true },
      take: 2000,
    }),
    prisma.couponClaim.findMany({
      where: { status: "used", usedAt: { gte: since }, coupon: { storeId } },
      select: { userId: true, usedAt: true },
      take: 2000,
    }),
  ]);

  const map = new Map<string, Agg>();
  const bump = (userId: string, weight: number, at: Date, sig: keyof RegularRow["signals"]) => {
    let a = map.get(userId);
    if (!a) {
      a = { score: 0, last: at, signals: { usedCoupons: 0, reviews: 0, intentVisits: 0, directions: 0, detailOpens: 0 } };
      map.set(userId, a);
    }
    const mult = at.getTime() >= recencyCut ? RECENCY_BOOST : 1;
    a.score += weight * mult;
    if (at > a.last) a.last = at;
    a.signals[sig] += 1;
  };

  for (const e of events) {
    if (!e.userId) continue;
    if (e.eventType === "intent_visit") bump(e.userId, W.intentVisit, e.createdAt, "intentVisits");
    else if (e.eventType === "directions_click") bump(e.userId, W.directions, e.createdAt, "directions");
    else if (e.eventType === "detail_open") bump(e.userId, W.detailOpen, e.createdAt, "detailOpens");
  }
  for (const r of reviews) bump(r.userId, W.review, r.createdAt, "reviews");
  for (const c of usedClaims) if (c.usedAt) bump(c.userId, W.usedCoupon, c.usedAt, "usedCoupons");

  if (map.size === 0) return [];

  // 닉네임/프사 해석(연락처는 절대 노출 안 함).
  const users = await prisma.user.findMany({
    where: { id: { in: [...map.keys()] } },
    select: { id: true, nickname: true, profileImgUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  let rows: RegularRow[] = [...map.entries()]
    .map(([userId, a]) => {
      const u = userMap.get(userId);
      return {
        userId,
        nickname: u?.nickname ?? "탈퇴한 손님",
        img: u?.profileImgUrl ?? null,
        score: Math.round(a.score * 10) / 10,
        segment: segmentFor(a.last, now),
        lastActivityAt: a.last.toISOString(),
        signals: a.signals,
      };
    })
    .filter((r) => userMap.has(r.userId)); // 탈퇴 사용자 제외

  if (opts.segment && opts.segment !== "all") {
    rows = rows.filter((r) => r.segment === opts.segment);
  }
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

/** 세그먼트별 요약 카운트(대시보드 카드용). */
export async function getRegularSummary(storeId: string, now: Date = new Date()) {
  const all = await getRegulars(storeId, { segment: "all", now });
  const summary = { total: all.length, active: 0, at_risk: 0, dormant: 0 };
  for (const r of all) summary[r.segment] += 1;
  return { summary, rows: all };
}
