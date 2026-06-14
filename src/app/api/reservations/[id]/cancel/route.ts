import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";

/**
 * M7(L2) — 예약 취소(재고 환원).
 * 픽업 전(reserved)만 취소 가능. 소비자 본인 또는 사장님/관리자. canceledBy 로 주체 기록.
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

    const isOwner = r.userId === user.id;
    const isMerchant = canManageStore(r.store, user);
    if (!isOwner && !isMerchant) {
      return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
    }
    if (r.status !== "reserved") {
      return NextResponse.json({ error: "취소할 수 없는 예약이에요." }, { status: 409 });
    }

    await prisma.reservation.update({
      where: { id },
      data: {
        status: "canceled",
        canceledAt: new Date(),
        canceledBy: isOwner ? "user" : "merchant",
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "취소에 실패했어요." }, { status: 500 });
  }
}
