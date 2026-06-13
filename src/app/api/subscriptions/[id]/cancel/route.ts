import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * M2 — 스폰서 구독 해지. 구독한 사장님 본인 또는 관리자만.
 * 다음 결제부터 중단(status=canceled). 현재 기간(Sponsorship.endsAt)의 노출은 만료일까지 유지(환불 없음).
 */
export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const sub = await prisma.subscription
    .findUnique({ where: { id }, select: { userId: true, status: true } })
    .catch(() => null);
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.role !== "admin" && sub.userId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (sub.status === "canceled") return NextResponse.json({ ok: true });

  await prisma.subscription.update({
    where: { id },
    data: { status: "canceled", canceledAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
