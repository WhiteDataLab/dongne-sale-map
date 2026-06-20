import Link from "next/link";
import { getAdminSession } from "@/lib/admin";
import { getRegionCategoryStats, getItemPriceStats, getMarketSummary, MIN_STORES } from "@/lib/insights";

/** L6 — 동네 물가/세일 데이터 B2B 리포트(관리자). 비식별 집계(k-익명 ≥ MIN_STORES 가게). */
export const dynamic = "force-dynamic";
export const metadata = { title: "물가 데이터 — 관리" };

export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) return null;
  const sp = await searchParams;
  const days = sp.days === "30" ? 30 : sp.days === "180" ? 180 : 90;

  const [summary, regionStats, itemStats] = await Promise.all([
    getMarketSummary(days),
    getRegionCategoryStats(days),
    getItemPriceStats(days, 30),
  ]);

  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">동네 물가 데이터 (B2B)</h1>
      <p className="mb-3 text-xs text-ink-3">
        세일 데이터의 비식별 집계예요. 가게 {MIN_STORES}곳 미만 버킷은 익명성 보장을 위해 숨겨져요. 지자체·리서치·FMCG 리포트 원천.
      </p>

      {/* 기간 선택 */}
      <div className="mb-3 flex items-center gap-2 text-sm">
        {[30, 90, 180].map((d) => (
          <Link
            key={d}
            href={`/admin/insights?days=${d}`}
            className={`rounded-full px-3 py-1 ${days === d ? "bg-gray-900 text-white" : "bg-surface-2 text-ink-2"}`}
          >
            {d}일
          </Link>
        ))}
        <a href={`/api/admin/insights/export?days=${days}&type=region`} className="ml-auto text-xs text-brand underline">동네×업종 CSV</a>
        <a href={`/api/admin/insights/export?days=${days}&type=item`} className="text-xs text-brand underline">품목 CSV</a>
      </div>

      {/* 요약 */}
      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] text-ink-3">세일 수</p>
          <p className="text-lg font-bold">{summary.totalSales.toLocaleString("ko-KR")}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] text-ink-3">활성 가게</p>
          <p className="text-lg font-bold">{summary.activeStores.toLocaleString("ko-KR")}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] text-ink-3">커버 동네</p>
          <p className="text-lg font-bold">{summary.regionsCovered}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] text-ink-3">공개 버킷</p>
          <p className="text-lg font-bold">{summary.publishedBuckets}</p>
        </div>
      </div>

      {/* 동네×업종 */}
      <h2 className="mb-1 text-sm font-bold">동네 × 업종 평균 세일가</h2>
      {regionStats.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
          아직 공개할 집계가 부족해요. (가게 {MIN_STORES}곳 이상 동네·업종 필요)
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line-2">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 text-ink-3">
              <tr>
                <th className="p-2 text-left">동네</th>
                <th className="p-2 text-left">업종</th>
                <th className="p-2 text-right">가게</th>
                <th className="p-2 text-right">세일</th>
                <th className="p-2 text-right">평균</th>
                <th className="p-2 text-right">최저~최고</th>
              </tr>
            </thead>
            <tbody>
              {regionStats.map((r) => (
                <tr key={`${r.region}-${r.category}`} className="border-t border-gray-50">
                  <td className="p-2 font-medium">{r.region}</td>
                  <td className="p-2">{r.categoryLabel}</td>
                  <td className="p-2 text-right">{r.storeCount}</td>
                  <td className="p-2 text-right">{r.saleCount}</td>
                  <td className="p-2 text-right font-bold">{won(r.avgPrice)}</td>
                  <td className="p-2 text-right text-ink-3">{won(r.minPrice)}~{won(r.maxPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 품목별 */}
      <h2 className="mb-1 mt-5 text-sm font-bold">품목별 가격 분포 (상위 {itemStats.length})</h2>
      {itemStats.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
          공개할 품목 집계가 부족해요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line-2">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 text-ink-3">
              <tr>
                <th className="p-2 text-left">품목</th>
                <th className="p-2 text-right">가게</th>
                <th className="p-2 text-right">세일</th>
                <th className="p-2 text-right">평균</th>
                <th className="p-2 text-right">최저~최고</th>
              </tr>
            </thead>
            <tbody>
              {itemStats.map((it) => (
                <tr key={it.item} className="border-t border-gray-50">
                  <td className="p-2 font-medium">{it.item}</td>
                  <td className="p-2 text-right">{it.storeCount}</td>
                  <td className="p-2 text-right">{it.saleCount}</td>
                  <td className="p-2 text-right font-bold">{won(it.avgPrice)}</td>
                  <td className="p-2 text-right text-ink-3">{won(it.minPrice)}~{won(it.maxPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
