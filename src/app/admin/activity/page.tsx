import { prisma } from "@/lib/prisma";

/**
 * 회원 활동 분석 (관리자): 콘텐츠 기여 기반 랭킹.
 * - 가게 등록 / 리뷰 / 세일 제보 순위 (정확)
 * - 활동 점수(가중 합) + 마지막 활동일로 '활발한 회원' 추정
 * - 순수 페이지뷰 트래픽은 별도 분석 추적 필요(미수집) → 콘텐츠 활동량으로 대체 표기
 */
export const dynamic = "force-dynamic";

// 활동 점수 가중치 (콘텐츠 생성 비용/가치 반영)
const W = { store: 4, sale: 2, review: 2, favorite: 1 };

type Agg = {
  stores: number;
  sales: number;
  reviews: number;
  favorites: number;
  lastAt: Date | null;
};

function emptyAgg(): Agg {
  return { stores: 0, sales: 0, reviews: 0, favorites: 0, lastAt: null };
}
function newer(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export default async function AdminActivity() {
  let rows: (Agg & { id: string; nickname: string; accountId: string | null; score: number })[] = [];
  let dbError = false;

  try {
    const ghost = await prisma.user.findFirst({
      where: { providerId: "deleted-user" },
      select: { id: true },
    });
    const ghostId = ghost?.id ?? "";

    const [storeG, saleG, reviewG, favG] = await Promise.all([
      prisma.store.groupBy({ by: ["createdById"], _count: true, _max: { createdAt: true } }),
      prisma.sale.groupBy({ by: ["createdById"], _count: true, _max: { createdAt: true } }),
      prisma.review.groupBy({ by: ["userId"], _count: true, _max: { createdAt: true } }),
      prisma.favorite.groupBy({ by: ["userId"], _count: true }),
    ]);

    const map = new Map<string, Agg>();
    const get = (id: string) => {
      let a = map.get(id);
      if (!a) {
        a = emptyAgg();
        map.set(id, a);
      }
      return a;
    };
    for (const g of storeG) {
      if (g.createdById === ghostId) continue;
      const a = get(g.createdById);
      a.stores = g._count;
      a.lastAt = newer(a.lastAt, g._max.createdAt);
    }
    for (const g of saleG) {
      if (g.createdById === ghostId) continue;
      const a = get(g.createdById);
      a.sales = g._count;
      a.lastAt = newer(a.lastAt, g._max.createdAt);
    }
    for (const g of reviewG) {
      if (g.userId === ghostId) continue;
      const a = get(g.userId);
      a.reviews = g._count;
      a.lastAt = newer(a.lastAt, g._max.createdAt);
    }
    for (const g of favG) {
      if (g.userId === ghostId) continue;
      get(g.userId).favorites = g._count;
    }

    const ids = [...map.keys()];
    const users = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, nickname: true, accountId: true },
        })
      : [];
    const uMap = new Map(users.map((u) => [u.id, u]));

    rows = ids.map((id) => {
      const a = map.get(id)!;
      const u = uMap.get(id);
      const score = a.stores * W.store + a.sales * W.sale + a.reviews * W.review + a.favorites * W.favorite;
      return {
        id,
        nickname: u?.nickname ?? "(알수없음)",
        accountId: u?.accountId ?? null,
        ...a,
        score,
      };
    });
  } catch {
    dbError = true;
  }

  if (dbError) {
    return <p className="py-10 text-center text-sm text-ink-3">활동 데이터를 불러오지 못했어요 (DB 연결 확인).</p>;
  }

  const byScore = [...rows].sort((a, b) => b.score - a.score).slice(0, 20);
  const byStores = [...rows].filter((r) => r.stores > 0).sort((a, b) => b.stores - a.stores).slice(0, 10);
  const byReviews = [...rows].filter((r) => r.reviews > 0).sort((a, b) => b.reviews - a.reviews).slice(0, 10);
  const bySales = [...rows].filter((r) => r.sales > 0).sort((a, b) => b.sales - a.sales).slice(0, 10);

  const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString("ko-KR") : "—");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold">회원 활동 분석</h2>
        <p className="text-xs text-ink-3">콘텐츠 기여 기반. 순수 페이지뷰 트래픽은 미수집(아래 안내).</p>
      </div>

      {/* 활발한 회원 (활동 점수) */}
      <section>
        <h3 className="mb-1 text-sm font-bold">🔥 활발한 회원 (활동 점수)</h3>
        <p className="mb-2 text-xs text-ink-3">
          점수 = 가게×{W.store} + 세일×{W.sale} + 리뷰×{W.review} + 즐겨찾기×{W.favorite}
        </p>
        {byScore.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-2 bg-surface-2 text-xs text-ink-3">
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">회원</th>
                  <th className="px-2 py-2 text-right font-medium">점수</th>
                  <th className="px-2 py-2 text-right font-medium">가게</th>
                  <th className="px-2 py-2 text-right font-medium">세일</th>
                  <th className="px-2 py-2 text-right font-medium">리뷰</th>
                  <th className="px-3 py-2 text-right font-medium">최근활동</th>
                </tr>
              </thead>
              <tbody>
                {byScore.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2 text-ink-3">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.nickname}</div>
                      {r.accountId && <div className="truncate text-[11px] text-ink-3">{r.accountId}</div>}
                    </td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums">{r.score}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-3">{r.stores}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-3">{r.sales}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-3">{r.reviews}</td>
                    <td className="px-3 py-2 text-right text-xs text-ink-3">{fmtDate(r.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RankList title="🏪 가게 등록 많이 한 회원" rows={byStores} metric={(r) => r.stores} unit="곳" />
      <RankList title="✍️ 리뷰 많이 쓴 회원" rows={byReviews} metric={(r) => r.reviews} unit="개" />
      <RankList title="🔥 세일 제보 많이 한 회원" rows={bySales} metric={(r) => r.sales} unit="건" />

      {/* 트래픽 안내 */}
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <p className="font-semibold">ℹ️ 홈페이지 트래픽(페이지뷰)에 대해</p>
        <p className="mt-1 text-amber-700">
          현재 페이지 방문/체류 같은 순수 트래픽은 수집하지 않아, 위 ‘활동 점수’(콘텐츠 기여량)로 활발도를 추정해요.
          실제 방문 트래픽까지 보려면 방문 이벤트 로깅(또는 GA4 등 분석 도구) 연동이 필요해요 — 원하면 붙여드릴게요.
        </p>
      </section>
    </div>
  );
}

type RankRow = {
  id: string;
  nickname: string;
  accountId: string | null;
  stores: number;
  reviews: number;
  sales: number;
};

function RankList({
  title,
  rows,
  metric,
  unit,
}: {
  title: string;
  rows: RankRow[];
  metric: (r: RankRow) => number;
  unit: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border border-line-2 px-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-center text-xs font-bold text-ink-3">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.nickname}</div>
                {r.accountId && <div className="truncate text-[11px] text-ink-3">{r.accountId}</div>}
              </div>
              <span className="shrink-0 font-bold tabular-nums">
                {metric(r)}
                <span className="ml-0.5 text-xs font-normal text-ink-3">{unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Empty() {
  return <p className="rounded-lg border border-line-2 py-6 text-center text-sm text-ink-3">아직 데이터가 없어요.</p>;
}
