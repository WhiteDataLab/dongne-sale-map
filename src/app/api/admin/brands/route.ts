import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import { getSiteSettings } from "@/lib/siteSettings";

/** L5 — 브랜드 스폰서 리워드 캠페인 관리(관리자 전용). */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let b: {
    brand?: string;
    giftItemId?: string;
    cpaKrw?: number;
    budgetKrw?: number;
    perUserLimit?: number;
    endsAt?: string | null;
    note?: string | null;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!b.brand?.trim() || !b.giftItemId) {
    return NextResponse.json({ error: "브랜드·대상 기프티콘은 필수예요." }, { status: 400 });
  }
  const gift = await prisma.giftItem.findUnique({ where: { id: b.giftItemId }, select: { id: true } });
  if (!gift) return NextResponse.json({ error: "기프티콘을 찾을 수 없어요." }, { status: 404 });

  const { brandMinCpa, brandMaxCpa, brandMinBudget } = await getSiteSettings();
  const cpaKrw = Math.round(Number(b.cpaKrw));
  const budgetKrw = Math.round(Number(b.budgetKrw));
  if (!Number.isFinite(cpaKrw) || cpaKrw < brandMinCpa || cpaKrw > brandMaxCpa) {
    return NextResponse.json({ error: `CPA 단가는 ${brandMinCpa}~${brandMaxCpa}원이에요.` }, { status: 400 });
  }
  if (!Number.isFinite(budgetKrw) || budgetKrw < brandMinBudget || budgetKrw < cpaKrw) {
    return NextResponse.json({ error: `예산은 ${brandMinBudget.toLocaleString()}원 이상이어야 해요.` }, { status: 400 });
  }
  const perUserLimit = Number.isInteger(b.perUserLimit) && (b.perUserLimit as number) > 0 ? (b.perUserLimit as number) : 1;
  const endsAt = b.endsAt ? new Date(b.endsAt) : null;

  const c = await prisma.brandCampaign.create({
    data: {
      brand: b.brand.trim(),
      giftItemId: b.giftItemId,
      cpaKrw,
      budgetKrw,
      perUserLimit,
      endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
      note: b.note?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, id: c.id });
}

export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let b: { id?: string; op?: string; amount?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!b.id) return NextResponse.json({ error: "id가 필요해요." }, { status: 400 });
  const c = await prisma.brandCampaign.findUnique({ where: { id: b.id } });
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (b.op === "pause") {
    await prisma.brandCampaign.update({ where: { id: c.id }, data: { status: "paused" } });
  } else if (b.op === "resume") {
    if (c.spentKrw >= c.budgetKrw) {
      return NextResponse.json({ error: "예산이 소진됐어요." }, { status: 409 });
    }
    await prisma.brandCampaign.update({ where: { id: c.id }, data: { status: "active" } });
  } else if (b.op === "end") {
    await prisma.brandCampaign.update({ where: { id: c.id }, data: { status: "ended" } });
  } else if (b.op === "topup") {
    const { brandMinBudget } = await getSiteSettings();
    const amount = Math.round(Number(b.amount));
    if (!Number.isFinite(amount) || amount < brandMinBudget) {
      return NextResponse.json({ error: `추가 예산은 ${brandMinBudget.toLocaleString()}원 이상이에요.` }, { status: 400 });
    }
    await prisma.brandCampaign.update({
      where: { id: c.id },
      data: { budgetKrw: { increment: amount }, status: c.status === "ended" ? "active" : c.status },
    });
  } else {
    return NextResponse.json({ error: "알 수 없는 동작이에요." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
