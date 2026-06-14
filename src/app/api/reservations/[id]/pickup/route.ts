import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";

/**
 * M7(L2) — 픽업 완료 처리(거래 확정).
 * 스캐너 없이 매장에서 자기처리(쿠폰 use 신뢰 모델). 소비자 본인 또는 사장님/관리자가 누를 수 있다.
 * 픽업 시 수수료(feeKrw)는 이미 예약 시 확정 — 여기선 상태만 picked_up 으로.
 */
export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    const r = await prisma.reservation.findUnique({
      where: { id },
      select: { status: true, userId: true, store: { select: { ownerId: true } } },
    });
    if (!r) return NextResponse.json({ error: "예약을 찾을 수 없어요." }, { status: 404 });

    const allowed = r.userId === user.id || canManageStore(r.store, user);
    if (!allowed) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });

    if (r.status !== "reserved") {
      return NextResponse.json({ error: "처리할 수 없는 예약이에요." }, { status: 409 });
    }

    await prisma.reservation.update({
      where: { id },
      data: { status: "picked_up", pickedUpAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "처리에 실패했어요." }, { status: 500 });
  }
}
