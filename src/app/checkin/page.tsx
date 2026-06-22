import Link from "next/link";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { kstTodayStart } from "@/lib/businessHours";
import { getPointConfig } from "@/lib/pointConfig";
import { CheckInButton } from "@/components/CheckInButton";

/** 출석체크 페이지. 매일 +10P, 연속 7일마다 +20P, 30일마다 +50P. */
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function CheckInPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-ink-3">
        <p className="mt-10">출석체크는 로그인 후 이용할 수 있어요.</p>
        <form
          action={async () => {
            "use server";
            await signIn(undefined, { redirectTo: "/checkin" });
          }}
        >
          <button className="mt-3 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white">
            로그인하기
          </button>
        </form>
        <Link href="/" className="mt-4 inline-block text-brand">
          ← 지도로
        </Link>
      </div>
    );
  }

  let lastCheckInDate: Date | null = null;
  let streak = 0;
  try {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lastCheckInDate: true, checkInStreak: true },
    });
    lastCheckInDate = me?.lastCheckInDate ?? null;
    streak = me?.checkInStreak ?? 0;
  } catch {
    // DB 미연결
  }

  const pc = await getPointConfig();
  const today = kstTodayStart();
  const yesterday = new Date(today.getTime() - DAY_MS);
  const last = lastCheckInDate ? new Date(lastCheckInDate) : null;
  const checkedToday = !!last && last.getTime() === today.getTime();
  const alive = checkedToday || (!!last && last.getTime() === yesterday.getTime());
  const effStreak = alive ? streak : 0; // 끊겼으면 0으로 표시

  const weekProgress = effStreak === 0 ? 0 : effStreak % 7 === 0 ? 7 : effStreak % 7;
  const monthProgress = Math.min(30, effStreak % 30 === 0 && effStreak > 0 ? 30 : effStreak % 30);

  return (
    <div className="h-full overflow-y-auto bg-surface-2">
      <div className="mx-auto flex max-w-md flex-col gap-4 p-5">
        <Link href="/" className="text-sm text-ink-3">
          ← 지도로
        </Link>

        <section className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <h1 className="text-xl font-bold">출석체크</h1>
          <p className="mt-1 text-sm text-ink-3">매일 출석하고 포인트를 모아요</p>

          <div className="mt-4 flex flex-col items-center">
            <span className="text-5xl">🔥</span>
            <p className="mt-1 text-3xl font-extrabold text-brand">{effStreak}일</p>
            <p className="text-xs text-ink-3">연속 출석</p>
          </div>

          {/* 주간(7일) 진행 */}
          <div className="mt-5 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-2">이번 주 출석 (7일마다 +{pc.checkinWeekly}P)</span>
              <span className="text-ink-3">{weekProgress}/7</span>
            </div>
            <div className="mt-1.5 flex justify-between gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-7 flex-1 rounded-md ${i < weekProgress ? "bg-blue-500" : "bg-surface-2"}`}
                />
              ))}
            </div>
          </div>

          {/* 월간(30일) 진행 */}
          <div className="mt-4 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-2">이번 달 출석 (30일마다 +{pc.checkinMonthly}P)</span>
              <span className="text-ink-3">{monthProgress}/30</span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${(monthProgress / 30) * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-5">
            <CheckInButton checkedToday={checkedToday} dailyPoint={pc.checkinDaily} />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 text-sm text-ink-2 shadow-sm">
          <h2 className="mb-2 font-semibold">적립 안내</h2>
          <ul className="flex flex-col gap-1 text-xs">
            <li>· 매일 출석 시 <b className="text-brand">+{pc.checkinDaily}P</b></li>
            <li>· 연속 7일마다 <b className="text-brand">+{pc.checkinWeekly}P</b> 추가</li>
            <li>· 연속 30일마다 <b className="text-amber-600">+{pc.checkinMonthly}P</b> 추가</li>
            <li className="text-ink-3">· 하루라도 빠지면 연속일수가 1일부터 다시 시작돼요. (한국시간 자정 기준)</li>
            <li className="text-ink-3">· 포인트는 적립 대기(표시용)예요.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
