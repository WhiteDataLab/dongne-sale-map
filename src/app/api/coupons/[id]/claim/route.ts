import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/** M3 — 소비자 쿠폰 받기(1인 1매). 종료/소진 쿠폰은 거절. */
export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    const now = new Date();
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      select: { id: true, status: true, expiresAt: true, totalLimit: true },
    });
    if (!coupon) return NextResponse.json({ error: "쿠폰을 찾을 수 없어요." }, { status: 404 });
    if (coupon.status !== "active" || coupon.expiresAt <= now) {
      return NextResponse.json({ error: "종료된 쿠폰이에요." }, { status: 410 });
    }
    // 수량 한도 체크(경합 시 약간의 초과 발급은 허용 — 수동 쿠폰이라 영향 미미)
    if (coupon.totalLimit != null) {
      const claimed = await prisma.couponClaim.count({ where: { couponId: id } });
      if (claimed >= coupon.totalLimit) {
        return NextResponse.json({ error: "쿠폰이 모두 소진됐어요." }, { status: 409 });
      }
    }

    try {
      await prisma.couponClaim.create({ data: { couponId: id, userId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "이미 받은 쿠폰이에요.", already: true }, { status: 409 });
      }
      throw e;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "쿠폰을 받지 못했어요." }, { status: 500 });
  }
}
