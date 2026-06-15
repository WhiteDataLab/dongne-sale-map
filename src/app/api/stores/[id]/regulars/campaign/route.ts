import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import { storeTier } from "@/lib/pro";
import { getRegulars, type RegularSegment } from "@/lib/regulars";
import { COUPON_TITLE_MAX, COUPON_TEXT_MAX } from "@/lib/coupons";
import { kstMonthStart, ALERT_TITLE_MAX, ALERT_BODY_MAX } from "@/lib/alerts";

/**
 * M10(수익화) — 컴백 쿠폰 캠페인(프로 전용).
 * 선택 세그먼트(또는 userId 배열) 단골에게 M3 쿠폰을 발행하고, 각 대상에게 쿠폰을 미리 지급(claim)하여
 * 내 쿠폰함(/coupons)에 바로 꽂는다(진짜 타게팅). 동시에 즐겨찾기 손님에게 알림(StoreAlert)도 보낸다.
 * 개인정보: 대상은 userId 로만 다루고 사장님 화면엔 연락처를 노출하지 않는다.
 */
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TARGETS = 500; // 쓰기 폭증 방지
const MONTHLY_CAMPAIGN_CAP = 2; // 가게당 월 캠페인 한도(스팸 방지)

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const store = await prisma.store
    .findUnique({ where: { id }, select: { id: true, ownerId: true, status: true } })
    .catch(() => null);
  if (!store || store.status !== "active") {
    return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
  }
  if (!canManageStore(store, user)) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }
  if ((await storeTier(id)) !== "pro") {
    return NextResponse.json(
      { error: "컴백 쿠폰 캠페인은 프로 플랜 전용이에요.", code: "pro_required" },
      { status: 402 },
    );
  }

  let body: {
    segment?: unknown;
    title?: unknown;
    condition?: unknown;
    expiresDays?: unknown;
    message?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const seg =
    body.segment === "active" || body.segment === "at_risk" || body.segment === "dormant"
      ? (body.segment as RegularSegment)
      : "at_risk"; // 기본: 이탈 위험 단골
  const title = typeof body.title === "string" ? body.title.trim().slice(0, COUPON_TITLE_MAX) : "";
  if (!title) return NextResponse.json({ error: "쿠폰 혜택(제목)을 입력해 주세요." }, { status: 400 });
  const condition = typeof body.condition === "string" ? body.condition.trim().slice(0, COUPON_TEXT_MAX) || null : null;
  const expiresDays = Math.min(60, Math.max(1, Number(body.expiresDays) || 14));
  const message = typeof body.message === "string" ? body.message.trim() : "";

  const now = new Date();

  // 월 캠페인 한도(스팸 방지): 이번 달 발행한 캠페인 쿠폰(=condition 으로 식별 불가하니 알림 notice 수로 근사).
  const monthlyCampaigns = await prisma.storeAlert.count({
    where: { storeId: id, kind: "notice", createdAt: { gte: kstMonthStart(now) } },
  });
  if (monthlyCampaigns >= MONTHLY_CAMPAIGN_CAP) {
    return NextResponse.json(
      { error: `이번 달 캠페인 한도를 모두 사용했어요. (월 ${MONTHLY_CAMPAIGN_CAP}회)`, code: "limit_reached" },
      { status: 409 },
    );
  }

  // 대상 단골 추출(세그먼트).
  const regulars = await getRegulars(id, { segment: seg, now });
  const targetIds = regulars.slice(0, MAX_TARGETS).map((r) => r.userId);
  if (targetIds.length === 0) {
    return NextResponse.json({ error: "해당 세그먼트에 단골이 없어요.", code: "no_targets" }, { status: 409 });
  }

  const expiresAt = new Date(now.getTime() + expiresDays * DAY_MS);

  // 쿠폰 발행 + 대상에게 미리 지급(claim) + 알림(StoreAlert) 을 트랜잭션으로.
  const result = await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.create({
      data: {
        storeId: id,
        title,
        description: "단골 컴백 쿠폰",
        condition,
        totalLimit: targetIds.length, // 타게팅된 수만큼만
        expiresAt,
        createdById: user.id,
      },
    });
    await tx.couponClaim.createMany({
      data: targetIds.map((uid) => ({ couponId: coupon.id, userId: uid, status: "claimed" as const })),
      skipDuplicates: true,
    });
    await tx.storeAlert.create({
      data: {
        storeId: id,
        createdById: user.id,
        kind: "notice",
        title: (message ? message.slice(0, ALERT_TITLE_MAX) : `🎟️ 컴백 쿠폰이 도착했어요`).slice(0, ALERT_TITLE_MAX),
        body: `${title}${condition ? ` (${condition})` : ""} — 내 쿠폰함에서 확인하세요`.slice(0, ALERT_BODY_MAX),
      },
    });
    return coupon;
  });

  return NextResponse.json({ ok: true, couponId: result.id, targeted: targetIds.length, segment: seg });
}
