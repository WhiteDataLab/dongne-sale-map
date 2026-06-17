import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import { ACTION_LABEL, type BillableAction } from "@/lib/ads";

/** L3 — 성과형 광고(CPA) 집행 현황(관리자). 월말 청구·정산의 근거 화면. */
export const dynamic = "force-dynamic";
export const metadata = { title: "성과형 광고 — 관리" };

const STATUS_LABEL: Record<string, string> = {
  active: "집행 중",
  paused: "일시중지",
  depleted: "예산 소진",
  canceled: "종료",
};

export default async function AdminAdsPage() {
  const session = await getAdminSession();
  if (!session) return null;

  const campaigns = await prisma.adCampaign.findMany({
    orderBy: [{ status: "asc" }, { spentKrw: "desc" }],
    take: 300,
    include: { store: { select: { name: true, address: true } } },
  });

  const billable = campaigns.filter((c) => c.status !== "canceled");
  const totalSpent = billable.reduce((a, c) => a + c.spentKrw, 0);
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">성과형 광고 (CPA)</h1>
      <p className="mb-3 text-xs text-gray-400">
        갈래요·길찾기 결과당 과금. 집행분은 월말 청구 근거(스캐폴드 — 실 청구 연동은 후속).
      </p>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-indigo-50 p-3">
          <p className="text-[11px] text-gray-400">집행 중</p>
          <p className="text-lg font-bold text-indigo-700">{activeCount}</p>
        </div>
        <div className="rounded-xl bg-green-50 p-3">
          <p className="text-[11px] text-gray-400">미정산 집행액</p>
          <p className="text-lg font-bold text-green-700">{totalSpent.toLocaleString("ko-KR")}원</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] text-gray-400">총 캠페인</p>
          <p className="text-lg font-bold text-gray-700">{campaigns.length}</p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          아직 성과형 광고 캠페인이 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <li key={c.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-medium">{c.store.name}</p>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">{c.store.address}</p>
              <p className="mt-1 text-xs text-gray-600">
                {ACTION_LABEL[c.action as BillableAction] ?? c.action} · 건당 {c.bidKrw.toLocaleString("ko-KR")}원 · 과금 {c.chargedCount}건
              </p>
              <p className="mt-0.5 text-xs">
                <b className="text-green-700">{c.spentKrw.toLocaleString("ko-KR")}원</b>
                <span className="text-gray-400"> / 예산 {c.budgetKrw.toLocaleString("ko-KR")}원</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
