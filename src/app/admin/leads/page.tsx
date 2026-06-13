import Link from "next/link";
import { getLeads, LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/leads";
import { CATEGORY_META, CATEGORIES } from "@/lib/constants";
import { setLeadStatus } from "../actions";

/**
 * M1-B(수익화) — 영업 리드 추출.
 * 주인 없는(미전환) 가게를 활동도(M0 노출·전환 + 콘텐츠)로 랭킹. 동/카테고리 필터 + CSV + 아웃리치 추적.
 */
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  new: "bg-gray-100 text-gray-600",
  contacted: "bg-blue-100 text-blue-700",
  proposed: "bg-amber-100 text-amber-700",
  converted: "bg-green-100 text-green-700",
  dropped: "bg-gray-100 text-gray-400 line-through",
};

function scoreColor(score: number): string {
  if (score >= 50) return "bg-red-500 text-white";
  if (score >= 20) return "bg-orange-400 text-white";
  if (score >= 5) return "bg-amber-300 text-amber-900";
  return "bg-gray-100 text-gray-500";
}

export default async function AdminLeads({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const region = typeof sp.region === "string" ? sp.region : "";
  const category = typeof sp.category === "string" ? sp.category : "";

  let leads: Awaited<ReturnType<typeof getLeads>> = [];
  let dbError = false;
  try {
    leads = await getLeads({ region, category, limit: 200 });
  } catch {
    dbError = true;
  }

  const exportQs = new URLSearchParams();
  if (region) exportQs.set("region", region);
  if (category) exportQs.set("category", category);
  const exportHref = `/api/admin/leads/export${exportQs.toString() ? `?${exportQs}` : ""}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">영업 리드</h2>
        <span className="text-xs text-gray-400">주인 없는 가게 · 활동도순 · 최대 200</span>
      </div>
      <p className="text-xs text-gray-500">
        사장님이 인증하지 않은(=미전환) 가게를 노출·전환·콘텐츠 활동으로 점수화했어요. 점수가 높을수록 핫리드예요.
      </p>

      {/* 필터 + CSV */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="region"
          defaultValue={region}
          placeholder="동/주소 검색 (예: 이문동)"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          name="category"
          defaultValue={category}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">전체 업종</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black">
          검색
        </button>
        <Link
          href={exportHref}
          prefetch={false}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          ⬇ CSV
        </Link>
      </form>

      {dbError ? (
        <p className="py-10 text-center text-sm text-gray-400">리드를 불러오지 못했어요 (DB 연결 확인).</p>
      ) : leads.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">조건에 맞는 리드가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {leads.map((l) => (
            <li key={l.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{l.name}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                      {CATEGORY_META[l.category].icon} {l.categoryLabel}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[l.outreachStatus] ?? ""}`}>
                      {LEAD_STATUS_LABEL[l.outreachStatus] ?? l.outreachStatus}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{l.address}</p>
                  <p className="text-xs text-gray-400">
                    {l.phone ? `📞 ${l.phone}` : "연락처 없음"} · {l.registeredBy}님 등록 ·{" "}
                    {new Date(l.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    노출 {l.impressions30} · 열람 {l.detailOpens30} · 길찾기 {l.directionsClicks30} · 방문의향{" "}
                    {l.intentVisits30} · 세일 {l.sales} · 리뷰 {l.reviews} · ♥ {l.favorites}
                    <span className="text-gray-300"> (최근 30일)</span>
                  </p>
                </div>
                <div className="shrink-0 text-center">
                  <span
                    className={`inline-block rounded-lg px-2 py-1 text-sm font-bold tabular-nums ${scoreColor(l.score)}`}
                  >
                    {l.score}
                  </span>
                  <p className="mt-0.5 text-[10px] text-gray-400">리드점수</p>
                </div>
              </div>

              {/* 아웃리치 상태/메모 */}
              <form action={setLeadStatus} className="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-50 pt-2">
                <input type="hidden" name="storeId" value={l.id} />
                <select
                  name="status"
                  defaultValue={l.outreachStatus}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="note"
                  defaultValue={l.outreachNote ?? ""}
                  placeholder="영업 메모"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs"
                />
                <button className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">
                  저장
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-400">
        · 점수 = 방문의향·길찾기·상세열람·노출(최근 30일) + 세일·리뷰·즐겨찾기 가중합. M0 트래픽이 쌓일수록 정확해져요.
        · ⚠️ 영업 연락은 <b>가게 공개 연락처</b>에만 하고, 광고성 정보 전송 규정(정보통신망법)을 지켜주세요.
      </p>
    </div>
  );
}
