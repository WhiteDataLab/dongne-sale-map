import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import { getStoreReservations } from "@/lib/reservations";

/**
 * M7(L2) — 사장님 대시보드: 우리 가게로 들어온 픽업 예약 목록(소유자·관리자만).
 */
export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const store = await prisma.store.findUnique({ where: { id }, select: { ownerId: true } });
  if (!store) return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
  if (!canManageStore(store, user)) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const reservations = await getStoreReservations(id);
  return NextResponse.json({ reservations });
}
