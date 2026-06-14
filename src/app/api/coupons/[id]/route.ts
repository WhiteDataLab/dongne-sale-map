import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";

/**
 * M3 — 쿠폰 내리기(PATCH action=end → status=hidden) / 삭제(DELETE).
 * 소유자(사장님)·관리자만. 내리면 노출 종료, 이미 받은 사용자에겐 '종료됨'으로 표시.
 */
export const runtime = "nodejs";

async function loadOwned(id: string) {
  return prisma.coupon.findUnique({
    where: { id },
    select: { id: true, store: { select: { id: true, ownerId: true } } },
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let action = "";
  try {
    action = String(((await req.json()) as { action?: string }).action ?? "");
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const coupon = await loadOwned(id);
  if (!coupon) return NextResponse.json({ error: "쿠폰을 찾을 수 없어요." }, { status: 404 });
  if (!canManageStore(coupon.store, user)) {
    return NextResponse.json({ error: "사장님·관리자만 변경할 수 있어요." }, { status: 403 });
  }

  if (action === "end") {
    await prisma.coupon.update({ where: { id }, data: { status: "hidden" } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "지원하지 않는 동작이에요." }, { status: 400 });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const coupon = await loadOwned(id);
  if (!coupon) return NextResponse.json({ error: "쿠폰을 찾을 수 없어요." }, { status: 404 });
  if (!canManageStore(coupon.store, user)) {
    return NextResponse.json({ error: "사장님·관리자만 삭제할 수 있어요." }, { status: 403 });
  }
  await prisma.coupon.delete({ where: { id } }); // CouponClaim cascade
  return NextResponse.json({ ok: true });
}
