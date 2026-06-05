import { prisma } from "@/lib/prisma";

/** 관리자 대시보드 — 가입·가게등록·세일제보·리뷰·신고의 오늘/어제/최근7일/누적 집계. */
export const dynamic = "force-dynamic";

/** KST(UTC+9) 기준 N일 전 자정을 실제 UTC Date 로. (createdAt 은 UTC 저장) */
function kstDayStart(daysAgo = 0): Date {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const startKstAsUtc = Date.UTC(
    nowKst.getUTCFullYear(),
    nowKst.getUTCMonth(),
    nowKst.getUTCDate() - daysAgo,
  );
  return new Date(startKstAsUtc - 9 * 60 * 60 * 1000);
}

type Counter = (args?: { where?: { createdAt?: { gte?: Date; lt?: Date } } }) => Promise<number>;

async function periodCounts(count: Counter) {
  const today = kstDayStart(0);
  const yesterday = kstDayStart(1);
  const week = kstDayStart(6); // 오늘 포함 최근 7일
  const [t, y, w, total] = await Promise.all([
    count({ where: { createdAt: { gte: today } } }),
    count({ where: { createdAt: { gte: yesterday, lt: today } } }),
    count({ where: { createdAt: { gte: week } } }),
    count(),
  ]);
  return { today: t, yesterday: y, week: w, total };
}

const EMPTY = { today: 0, yesterday: 0, week: 0, total: 0 };

export default async function AdminDashboard() {
  let rows: { label: string; emoji: string; data: typeof EMPTY }[] = [];
  let dbError = false;

  try {
    const [users, stores, sales, reviews, reports] = await Promise.all([
      periodCounts((a) => prisma.user.count(a)),
      periodCounts((a) => prisma.store.count(a)),
      periodCounts((a) => prisma.sale.count(a)),
      periodCounts((a) => prisma.review.count(a)),
      periodCounts((a) => prisma.report.count(a)),
    ]);
    rows = [
      { label: "회원가입", emoji: "🙋", data: users },
      { label: "가게 등록", emoji: "🏪", data: stores },
      { label: "세일 제보", emoji: "🔥", data: sales },
      { label: "리뷰 작성", emoji: "✍️", data: reviews },
      { label: "신고 접수", emoji: "🚩", data: reports },
    ];
  } catch {
    dbError = true;
  }

  const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  if (dbError) {
    return <p className="py-10 text-center text-sm text-gray-400">통계를 불러오지 못했어요 (DB 연결 확인).</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">대시보드</h2>
        <p className="text-xs text-gray-400">기준 시각: {kstToday} (KST) · 자동 갱신은 새로고침</p>
      </div>

      {/* 오늘 활동 하이라이트 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl border border-gray-200 p-3 text-center">
            <div className="text-xl">{r.emoji}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{r.data.today}</div>
            <div className="text-[11px] text-gray-400">오늘 {r.label}</div>
          </div>
        ))}
      </div>

      {/* 상세 표 */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2 text-left font-medium">항목</th>
              <th className="px-3 py-2 text-right font-medium">오늘</th>
              <th className="px-3 py-2 text-right font-medium">어제</th>
              <th className="px-3 py-2 text-right font-medium">최근 7일</th>
              <th className="px-3 py-2 text-right font-medium">누적</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2.5 font-medium">
                  {r.emoji} {r.label}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.data.today}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.data.yesterday}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.data.week}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{r.data.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        · 일자 경계는 한국시간(KST) 자정 기준이에요. · 누적은 전체 기간 합계예요.
      </p>
    </div>
  );
}
