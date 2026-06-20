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

// 탈퇴 sentinel(고스트) 계정은 실제 회원이 아니므로 통계에서 제외
const NOT_GHOST = { providerId: { not: "deleted-user" } };

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
  const providers = { kakao: 0, naver: 0, phone: 0 };
  let dbError = false;

  try {
    const [users, stores, sales, reviews, reports, withdrawals, byProvider] = await Promise.all([
      periodCounts((a) => prisma.user.count({ where: { ...(a?.where ?? {}), ...NOT_GHOST } })),
      periodCounts((a) => prisma.store.count(a)),
      periodCounts((a) => prisma.sale.count(a)),
      periodCounts((a) => prisma.review.count(a)),
      periodCounts((a) => prisma.report.count(a)),
      periodCounts((a) => prisma.withdrawalLog.count(a)),
      prisma.user.groupBy({ by: ["provider"], where: NOT_GHOST, _count: true }),
    ]);
    rows = [
      { label: "회원가입", emoji: "🙋", data: users },
      { label: "가게 등록", emoji: "🏪", data: stores },
      { label: "세일 제보", emoji: "🔥", data: sales },
      { label: "리뷰 작성", emoji: "✍️", data: reviews },
      { label: "신고 접수", emoji: "🚩", data: reports },
      { label: "회원 탈퇴", emoji: "👋", data: withdrawals },
    ];
    for (const g of byProvider) {
      if (g.provider === "kakao") providers.kakao = g._count;
      else if (g.provider === "naver") providers.naver = g._count;
      else if (g.provider === "phone") providers.phone = g._count;
    }
  } catch {
    dbError = true;
  }

  const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  if (dbError) {
    return <p className="py-10 text-center text-sm text-ink-3">통계를 불러오지 못했어요 (DB 연결 확인).</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">대시보드</h2>
        <p className="text-xs text-ink-3">기준 시각: {kstToday} (KST) · 자동 갱신은 새로고침</p>
      </div>

      {/* 오늘 활동 하이라이트 */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl border border-line p-3 text-center">
            <div className="text-xl">{r.emoji}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{r.data.today}</div>
            <div className="text-[11px] text-ink-3">오늘 {r.label}</div>
          </div>
        ))}
      </div>

      {/* 상세 표 */}
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-2 bg-surface-2 text-xs text-ink-3">
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
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-3">{r.data.yesterday}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-3">{r.data.week}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{r.data.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 가입 경로별 현재 회원 */}
      <div>
        <h3 className="mb-2 text-sm font-bold">가입 경로별 현재 회원</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "카카오", emoji: "💬", n: providers.kakao, color: "bg-yellow-50 text-yellow-700" },
            { label: "네이버", emoji: "🟢", n: providers.naver, color: "bg-green-50 text-green-700" },
            { label: "전화번호", emoji: "📱", n: providers.phone, color: "bg-brand-wash text-brand-ink" },
          ].map((p) => (
            <div key={p.label} className={`rounded-xl p-3 text-center ${p.color}`}>
              <div className="text-lg">{p.emoji}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{p.n}</div>
              <div className="text-[11px] opacity-70">{p.label} 가입</div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-3">
          현재 회원 합계 {providers.kakao + providers.naver + providers.phone}명 (탈퇴·sentinel 제외)
        </p>
      </div>

      <p className="text-xs text-ink-3">
        · 일자 경계는 한국시간(KST) 자정 기준이에요. · 누적은 전체 기간 합계예요. · 회원 탈퇴는 로그 도입 이후부터 집계돼요.
      </p>
    </div>
  );
}
