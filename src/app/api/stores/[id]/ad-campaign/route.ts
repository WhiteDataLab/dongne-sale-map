import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import {
  getActiveAdCampaign,
  isBillableAction,
  AD_MIN_BID,
  AD_MAX_BID,
  AD_MIN_BUDGET,
  AD_MAX_BUDGET,
} from "@/lib/ads";

/**
 * L3(수익화) — 성과형 광고(CPA) 캠페인 관리(사장님/관리자).
 * 결과당 과금: 갈래요·길찾기 1건당 입찰가. 예산 소진 시 자동 중지. 집행분은 월말 청구(스캐폴드).
 */
export const runtime = "nodejs";

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
    return { error: NextResponse.json({ error: "사장님·관리자만 광고를 관리할 수 있어요." }, { status: 403 }) };
  }
  return { user };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ campaign: await getActiveAdCampaign(id) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;

  // 이미 진행/일시중지/소진 캠페인이 있으면 1개 제한(취소된 건 새로 가능).
  const existing = await prisma.adCampaign.findFirst({
    where: { storeId: id, status: { in: ["active", "paused", "depleted"] } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 진행 중인 광고가 있어요.", code: "exists" }, { status: 409 });
  }

  let body: { action?: unknown; bidKrw?: unknown; budgetKrw?: unknown; dailyCapKrw?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!isBillableAction(body.action)) {
    return NextResponse.json({ error: "과금 대상(갈래요/길찾기)을 선택해 주세요." }, { status: 400 });
  }
  const bidKrw = Math.round(Number(body.bidKrw));
  const budgetKrw = Math.round(Number(body.budgetKrw));
  if (!Number.isFinite(bidKrw) || bidKrw < AD_MIN_BID || bidKrw > AD_MAX_BID) {
    return NextResponse.json({ error: `입찰가는 ${AD_MIN_BID}~${AD_MAX_BID}원이에요.` }, { status: 400 });
  }
  if (!Number.isFinite(budgetKrw) || budgetKrw < AD_MIN_BUDGET || budgetKrw > AD_MAX_BUDGET) {
    return NextResponse.json({ error: `예산은 ${AD_MIN_BUDGET.toLocaleString()}원 이상이에요.` }, { status: 400 });
  }
  if (budgetKrw < bidKrw) {
    return NextResponse.json({ error: "예산은 입찰가보다 커야 해요." }, { status: 400 });
  }
  let dailyCapKrw: number | null = null;
  if (body.dailyCapKrw != null && body.dailyCapKrw !== "") {
    const d = Math.round(Number(body.dailyCapKrw));
    if (Number.isFinite(d) && d >= bidKrw) dailyCapKrw = d;
  }

  const c = await prisma.adCampaign.create({
    data: { storeId: id, userId: auth.user.id, action: body.action, bidKrw, budgetKrw, dailyCapKrw },
  });
  return NextResponse.json({ ok: true, campaignId: c.id });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;

  let body: { op?: unknown; amount?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const campaign = await prisma.adCampaign.findFirst({
    where: { storeId: id, status: { in: ["active", "paused", "depleted"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!campaign) return NextResponse.json({ error: "진행 중인 광고가 없어요." }, { status: 404 });

  const op = body.op;
  if (op === "pause") {
    await prisma.adCampaign.update({ where: { id: campaign.id }, data: { status: "paused" } });
  } else if (op === "resume") {
    // 예산이 남아 있으면 재개, 소진이면 막음.
    if (campaign.spentKrw >= campaign.budgetKrw) {
      return NextResponse.json({ error: "예산이 소진됐어요. 예산을 추가해 주세요.", code: "depleted" }, { status: 409 });
    }
    await prisma.adCampaign.update({ where: { id: campaign.id }, data: { status: "active" } });
  } else if (op === "cancel") {
    await prisma.adCampaign.update({ where: { id: campaign.id }, data: { status: "canceled" } });
  } else if (op === "topup") {
    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount < AD_MIN_BUDGET) {
      return NextResponse.json({ error: `추가 예산은 ${AD_MIN_BUDGET.toLocaleString()}원 이상이에요.` }, { status: 400 });
    }
    // 예산 추가 + 소진 상태였으면 재가동.
    const nextStatus = campaign.status === "depleted" ? "active" : campaign.status;
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { budgetKrw: { increment: amount }, status: nextStatus },
    });
  } else {
    return NextResponse.json({ error: "알 수 없는 동작이에요." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
