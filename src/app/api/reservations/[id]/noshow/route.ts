import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";

/**
 * M7(L2) — 노쇼 처리(픽업 마감까지 미수령). 사장님/관리자만.
 * reserved 예약을 no_show 로 — 재고는 환원(활성 점유에서 빠짐). 반복 노쇼 패널티는 Phase 2.
 */
export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    const r = await prisma.reservation.findUnique({
      where: { id },
      select: { status: true, store: { select: { ownerId: true } } },
    });
    if (!r) return NextResponse.json({ error: "예약을 찾을 수 없어요." }, { status: 404 });
    if (!canManageStore(r.store, user)) {
      return NextResponse.json({ error: "사장님만 처리할 수 있어요." }, { status: 403 });
    }
    if (r.status !== "reserved") {
      return NextResponse.json({ error: "처리할 수 없는 예약이에요." }, { status: 409 });
    }

    await prisma.reservation.update({
      where: { id },
      data: { status: "no_show", canceledAt: new Date(), canceledBy: "system" },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "처리에 실패했어요." }, { status: 500 });
  }
}
