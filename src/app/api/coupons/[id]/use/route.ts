import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/**
 * M3 — 쿠폰 사용 처리. 스캐너 없이 소비자가 매장에서 '사용하기'를 눌러 자기처리(앱 신뢰 모델).
 * 받은 쿠폰만, 미사용·유효 상태일 때만.
 */
export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    const now = new Date();
    const claim = await prisma.couponClaim.findUnique({
      where: { couponId_userId: { couponId: id, userId } },
      select: {
        id: true,
        status: true,
        coupon: { select: { status: true, expiresAt: true } },
      },
    });
    if (!claim) return NextResponse.json({ error: "받지 않은 쿠폰이에요." }, { status: 404 });
    if (claim.status === "used") {
      return NextResponse.json({ error: "이미 사용한 쿠폰이에요." }, { status: 409 });
    }
    if (claim.coupon.status !== "active" || claim.coupon.expiresAt <= now) {
      return NextResponse.json({ error: "종료된 쿠폰이에요." }, { status: 410 });
    }
    await prisma.couponClaim.update({
      where: { id: claim.id },
      data: { status: "used", usedAt: now },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "사용 처리에 실패했어요." }, { status: 500 });
  }
}
