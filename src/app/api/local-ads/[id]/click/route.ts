import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ipLimit } from "@/lib/rateLimit";

/** L4 — 로컬 광고 클릭 집계(공개). IP 레이트리밋으로 클릭 인플레이션 방어. */
export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const limited = await ipLimit(req, `localad-click:${id}`, 10, 60_000);
  if (limited) return limited;
  try {
    await prisma.localAd.update({ where: { id }, data: { clicks: { increment: 1 } } });
  } catch {
    // 광고가 없거나 종료 — 무시(베스트에포트)
  }
  return NextResponse.json({ ok: true });
}
