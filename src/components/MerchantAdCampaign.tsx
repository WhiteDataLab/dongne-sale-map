"use client";

import { useCallback, useEffect, useState } from "react";

type Campaign = {
  id: string;
  action: "intent_visit" | "directions_click";
  actionLabel: string;
  bidKrw: number;
  budgetKrw: number;
  spentKrw: number;
  remainingKrw: number;
  chargedCount: number;
  dailyCapKrw: number | null;
  status: "active" | "paused" | "depleted" | "canceled";
  createdAt: string;
};

const STATUS_LABEL: Record<Campaign["status"], { txt: string; cls: string }> = {
  active: { txt: "집행 중", cls: "bg-green-100 text-green-700" },
  paused: { txt: "일시중지", cls: "bg-gray-200 text-ink-2" },
  depleted: { txt: "예산 소진", cls: "bg-amber-100 text-amber-700" },
  canceled: { txt: "종료", cls: "bg-surface-2 text-ink-3" },
};

/**
 * L3 — 성과형 광고(CPA). 갈래요·길찾기 1건당 입찰가만큼만 과금(결과당 과금).
 * 정액 부담 없이 "실제로 손님이 움직일 때만" 비용이 든다.
 */
export function MerchantAdCampaign({ storeId, onToast }: { storeId: string; onToast: (m: string) => void }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  // 생성 폼
  const [action, setAction] = useState<"intent_visit" | "directions_click">("intent_visit");
  const [bid, setBid] = useState(300);
  const [budget, setBudget] = useState(30000);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/stores/${storeId}/ad-campaign`);
      if (res.ok) setCampaign(((await res.json()) as { campaign: Campaign | null }).campaign);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/ad-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, bidKrw: bid, budgetKrw: budget }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onToast(data.error ?? "광고 시작에 실패했어요.");
        return;
      }
      onToast("성과형 광고를 시작했어요! 🚀");
      load();
    } finally {
      setBusy(false);
    }
  };

  const op = async (operation: string, amount?: number) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/ad-campaign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: operation, amount }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onToast(data.error ?? "변경에 실패했어요.");
        return;
      }
      onToast("변경했어요.");
      load();
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <p className="py-8 text-center text-sm text-ink-3">불러오는 중…</p>;

  if (campaign) {
    const pct = campaign.budgetKrw > 0 ? Math.min(100, Math.round((campaign.spentKrw / campaign.budgetKrw) * 100)) : 0;
    const cpc = campaign.chargedCount > 0 ? Math.round(campaign.spentKrw / campaign.chargedCount) : campaign.bidKrw;
    const s = STATUS_LABEL[campaign.status];
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">{campaign.actionLabel} 광고</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.txt}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-3">건당 {campaign.bidKrw.toLocaleString("ko-KR")}원 과금</p>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-ink-3">
            <span>집행 {campaign.spentKrw.toLocaleString("ko-KR")}원</span>
            <span>예산 {campaign.budgetKrw.toLocaleString("ko-KR")}원</span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg bg-surface-2 px-2 py-1.5">
              <p className="text-[10px] text-ink-3">과금 액션</p>
              <p className="text-sm font-bold">{campaign.chargedCount}</p>
            </div>
            <div className="rounded-lg bg-surface-2 px-2 py-1.5">
              <p className="text-[10px] text-ink-3">잔여 예산</p>
              <p className="text-sm font-bold">{campaign.remainingKrw.toLocaleString("ko-KR")}</p>
            </div>
            <div className="rounded-lg bg-surface-2 px-2 py-1.5">
              <p className="text-[10px] text-ink-3">평균 단가</p>
              <p className="text-sm font-bold">{cpc.toLocaleString("ko-KR")}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {campaign.status === "active" && (
              <button type="button" disabled={busy} onClick={() => op("pause")} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 disabled:opacity-50">
                일시중지
              </button>
            )}
            {campaign.status === "paused" && (
              <button type="button" disabled={busy} onClick={() => op("resume")} className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 disabled:opacity-50">
                재개
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => op("topup", 30000)} className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 disabled:opacity-50">
              + 예산 3만원
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("이 광고를 종료할까요? 집행된 비용은 청구돼요.")) op("cancel");
              }}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-3 disabled:opacity-50"
            >
              종료
            </button>
          </div>
        </div>
        <p className="text-[11px] text-ink-3">
          ※ 집행 비용은 월말에 정산·청구돼요(현재 스캐폴드). 같은 손님이 같은 날 여러 번 눌러도 1회만 과금돼요(어뷰징 방어).
        </p>
      </div>
    );
  }

  // 캠페인 없음 → 생성 폼
  const estActions = Math.floor(budget / bid);
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
        <p className="text-sm font-bold text-indigo-700">🚀 결과당 과금 광고</p>
        <p className="mt-0.5 text-xs text-ink-3">
          정액 구독이 부담되면, <b>손님이 실제로 움직일 때만</b> 비용을 내세요. 갈래요·길찾기 1건당 입찰가만큼만 차감돼요.
        </p>

        <label className="mt-3 block text-xs font-medium text-ink-3">과금 대상</label>
        <div className="mt-1 flex gap-1.5">
          {(
            [
              ["intent_visit", "🏃 갈래요"],
              ["directions_click", "🧭 길찾기"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setAction(v)}
              className={[
                "flex-1 rounded-lg px-2 py-2 text-xs font-medium transition",
                action === v ? "bg-indigo-600 text-white" : "bg-white text-ink-3 border border-line",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="mt-3 block text-xs font-medium text-ink-3">건당 입찰가</label>
        <div className="mt-1 flex gap-1.5">
          {[200, 300, 500, 1000].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBid(b)}
              className={[
                "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                bid === b ? "bg-gray-900 text-white" : "bg-white text-ink-3 border border-line",
              ].join(" ")}
            >
              {b.toLocaleString("ko-KR")}원
            </button>
          ))}
        </div>

        <label className="mt-3 block text-xs font-medium text-ink-3">예산</label>
        <div className="mt-1 flex gap-1.5">
          {[10000, 30000, 50000, 100000].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBudget(b)}
              className={[
                "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                budget === b ? "bg-gray-900 text-white" : "bg-white text-ink-3 border border-line",
              ].join(" ")}
            >
              {(b / 10000).toLocaleString("ko-KR")}만
            </button>
          ))}
        </div>

        <p className="mt-2 text-[11px] text-ink-3">예산 소진까지 최대 약 {estActions.toLocaleString("ko-KR")}건 과금</p>

        <button
          type="button"
          disabled={busy}
          onClick={create}
          className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "시작 중…" : "광고 시작하기"}
        </button>
      </div>
    </div>
  );
}
