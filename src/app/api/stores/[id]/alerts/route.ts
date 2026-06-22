import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import { storeTier, tierAllowsLite } from "@/lib/pro";
import { rateLimit } from "@/lib/rateLimit";
import {
  alertsSentThisMonth,
  remainingAlerts,
  getStoreAlerts,
  ALERT_TITLE_MAX,
  ALERT_BODY_MAX,
} from "@/lib/alerts";
import { kstTodayStart } from "@/lib/businessHours";
import { getSiteSettings } from "@/lib/siteSettings";

/**
 * M9(수익화) — 세일/소식 알림 발송.
 * 발송(POST)/이력(GET) 모두 canManageStore + 라이트+ 게이팅. 월 한도(Lite 4/Pro 무제한) + 1일 빈도 캡.
 */
export const runtime = "nodejs";

/** 공통: 가게 로드 + 권한 + 티어. */
async function authorize(storeId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "login_required" }, { status: 401 }) };
  const store = await prisma.store
    .findUnique({ where: { id: storeId }, select: { id: true, ownerId: true, status: true } })
    .catch(() => null);
  if (!store || store.status !== "active") {
    return { error: NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 }) };
  }
  if (!canManageStore(store, user)) {
    return { error: NextResponse.json({ error: "사장님·관리자만 알림을 보낼 수 있어요." }, { status: 403 }) };
  }
  const tier = await storeTier(storeId);
  return { user, store, tier };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;

  const now = new Date();
  const { alertLiteMonthly } = await getSiteSettings();
  const [sentThisMonth, alerts, favoriteCount] = await Promise.all([
    alertsSentThisMonth(id, now),
    getStoreAlerts(id),
    prisma.favorite.count({ where: { storeId: id } }),
  ]);
  const remaining = remainingAlerts(auth.tier, sentThisMonth, alertLiteMonthly);
  return NextResponse.json({
    tier: auth.tier,
    canSend: tierAllowsLite(auth.tier),
    sentThisMonth,
    monthlyLimit: auth.tier === "pro" ? null : alertLiteMonthly,
    remaining: remaining === Infinity ? null : remaining,
    favoriteCount,
    alerts,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;
  const { user, tier } = auth;

  if (!tierAllowsLite(tier)) {
    return NextResponse.json(
      { error: "세일 알림은 라이트 플랜부터 보낼 수 있어요.", code: "tier_required" },
      { status: 402 },
    );
  }

  let body: { title?: unknown; body?: unknown; saleId?: unknown; kind?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, ALERT_TITLE_MAX) : "";
  const text = typeof body.body === "string" ? body.body.trim().slice(0, ALERT_BODY_MAX) : "";
  if (!title || !text) {
    return NextResponse.json({ error: "제목·내용을 입력해 주세요." }, { status: 400 });
  }
  const kind = body.kind === "notice" ? "notice" : "sale";
  let saleId: string | null = typeof body.saleId === "string" ? body.saleId : null;

  const now = new Date();

  // 세일 연동 시 해당 가게의 활성 세일인지 검증.
  if (saleId) {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, storeId: id },
      select: { id: true },
    });
    if (!sale) saleId = null;
  }

  // 월 한도(라이트) 체크.
  const { alertLiteMonthly, alertDaily } = await getSiteSettings();
  const sentThisMonth = await alertsSentThisMonth(id, now);
  if (remainingAlerts(tier, sentThisMonth, alertLiteMonthly) <= 0) {
    return NextResponse.json(
      { error: `이번 달 발송 횟수를 모두 사용했어요. (라이트 월 ${alertLiteMonthly}회)`, code: "limit_reached" },
      { status: 409 },
    );
  }

  // 1일 빈도 캡(도배 방지).
  const sentToday = await prisma.storeAlert.count({
    where: { storeId: id, createdAt: { gte: kstTodayStart() } },
  });
  if (sentToday >= alertDaily) {
    return NextResponse.json({ error: "오늘은 더 보낼 수 없어요. (하루 한도 초과)" }, { status: 429 });
  }

  // 동일 내용 연타 방지 + 레이트리밋.
  const { ok } = await rateLimit(`store-alert:${id}`, 3, 60_000);
  if (!ok) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });

  await prisma.storeAlert.create({
    data: { storeId: id, createdById: user.id, kind, saleId, title, body: text },
  });

  const favoriteCount = await prisma.favorite.count({ where: { storeId: id } });
  return NextResponse.json({ ok: true, favoriteCount });
}
