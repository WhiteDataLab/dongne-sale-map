import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { kstTodayStart } from "@/lib/businessHours";
import { getPointConfig } from "@/lib/pointConfig";

/**
 * 출석체크 (하루 1회). 포인트(pending):
 *  - 매일 +10P
 *  - 연속 7일마다 +20P (주간)
 *  - 연속 30일마다 +50P (월간)
 * 연속 출석 streak 은 KST 자정 기준으로 끊김 판정.
 */
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastCheckInDate: true, checkInStreak: true },
    });
    if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });

    const today = kstTodayStart();
    const yesterday = new Date(today.getTime() - DAY_MS);
    const last = user.lastCheckInDate ? new Date(user.lastCheckInDate) : null;

    if (last && last.getTime() === today.getTime()) {
      return NextResponse.json(
        { error: "오늘은 이미 출석했어요.", alreadyChecked: true, streak: user.checkInStreak },
        { status: 409 },
      );
    }

    // 연속 여부: 어제 출석이면 streak+1, 아니면(또는 최초) 1로 리셋
    const streak = last && last.getTime() === yesterday.getTime() ? user.checkInStreak + 1 : 1;

    const pc = await getPointConfig();
    const weekly = streak % 7 === 0 ? pc.checkinWeekly : 0;
    const monthly = streak % 30 === 0 ? pc.checkinMonthly : 0;
    const total = pc.checkinDaily + weekly + monthly;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { lastCheckInDate: today, checkInStreak: streak },
      });
      const logs = [
        { amount: pc.checkinDaily, reason: `출석체크 (${streak}일 연속)` },
        ...(weekly ? [{ amount: weekly, reason: "주간 출석 보너스 (7일)" }] : []),
        ...(monthly ? [{ amount: monthly, reason: "월간 출석 보너스 (30일)" }] : []),
      ];
      await tx.pointLog.createMany({
        data: logs.map((l) => ({
          userId,
          amount: l.amount,
          reason: l.reason,
          status: "pending" as const,
          refType: "checkin",
        })),
      });
    });

    return NextResponse.json({
      ok: true,
      streak,
      awarded: { daily: pc.checkinDaily, weekly, monthly, total },
    });
  } catch {
    return NextResponse.json({ error: "출석체크에 실패했어요." }, { status: 500 });
  }
}
