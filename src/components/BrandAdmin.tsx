"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandCampaignRow } from "@/lib/brands";

type GiftOption = { id: string; label: string };

const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
  active: { txt: "집행 중", cls: "bg-green-100 text-green-700" },
  paused: { txt: "일시중지", cls: "bg-gray-200 text-ink-2" },
  ended: { txt: "종료", cls: "bg-surface-2 text-ink-3" },
};

/** L5 — 브랜드 스폰서 리워드 캠페인 관리(관리자). 생성 + 상태 제어. */
export function BrandAdmin({ gifts, campaigns }: { gifts: GiftOption[]; campaigns: BrandCampaignRow[] }) {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [giftItemId, setGiftItemId] = useState(gifts[0]?.id ?? "");
  const [cpaKrw, setCpaKrw] = useState(800);
  const [budgetKrw, setBudgetKrw] = useState(100000);
  const [perUserLimit, setPerUserLimit] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const create = async () => {
    if (!brand.trim() || !giftItemId) {
      setMsg("브랜드·기프티콘을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, giftItemId, cpaKrw, budgetKrw, perUserLimit }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "생성 실패");
        return;
      }
      setBrand("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const op = async (id: string, operation: string, amount?: number) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, op: operation, amount }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const live = campaigns.filter((c) => c.status !== "ended");
  const totalRevenue = live.reduce((a, c) => a + c.spentKrw, 0);
  const totalCostOffset = live.reduce((a, c) => a + (c.giftCostKrw ?? 0) * c.redeemedCount, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* 리포트 요약 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-indigo-50 p-3">
          <p className="text-[11px] text-ink-3">브랜드 매출(CPA)</p>
          <p className="text-lg font-bold text-indigo-700">{totalRevenue.toLocaleString("ko-KR")}원</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-[11px] text-ink-3">상쇄된 기프티콘 원가</p>
          <p className="text-lg font-bold text-amber-700">{totalCostOffset.toLocaleString("ko-KR")}원</p>
        </div>
        <div className="rounded-xl bg-green-50 p-3">
          <p className="text-[11px] text-ink-3">순효과</p>
          <p className="text-lg font-bold text-green-700">{(totalRevenue - totalCostOffset).toLocaleString("ko-KR")}원</p>
        </div>
      </div>

      {/* 생성 폼 */}
      <div className="rounded-xl border border-line p-3">
        <p className="mb-2 text-sm font-bold">+ 브랜드 캠페인 만들기</p>
        {gifts.length === 0 ? (
          <p className="text-xs text-ink-3">먼저 포인트샵에 기프티콘 상품을 등록해 주세요.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="후원 브랜드명 (예: ○○음료)"
              className="rounded-md border border-line px-2.5 py-2 text-sm"
            />
            <select
              value={giftItemId}
              onChange={(e) => setGiftItemId(e.target.value)}
              className="rounded-md border border-line px-2 py-2 text-sm"
            >
              {gifts.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-1.5">
              <label className="text-[11px] text-ink-3">
                CPA단가
                <input type="number" value={cpaKrw} onChange={(e) => setCpaKrw(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-line px-2 py-1.5 text-sm" />
              </label>
              <label className="text-[11px] text-ink-3">
                예산
                <input type="number" value={budgetKrw} onChange={(e) => setBudgetKrw(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-line px-2 py-1.5 text-sm" />
              </label>
              <label className="text-[11px] text-ink-3">
                1인 한도
                <input type="number" value={perUserLimit} onChange={(e) => setPerUserLimit(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-line px-2 py-1.5 text-sm" />
              </label>
            </div>
            <button type="button" disabled={busy} onClick={create} className="mt-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
              {busy ? "처리 중…" : "캠페인 시작"}
            </button>
            {msg && <p className="text-xs text-red-500">{msg}</p>}
          </div>
        )}
      </div>

      {/* 캠페인 목록 */}
      {campaigns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">아직 캠페인이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => {
            const s = STATUS_LABEL[c.status] ?? { txt: c.status, cls: "bg-surface-2 text-ink-3" };
            const pct = c.budgetKrw > 0 ? Math.min(100, Math.round((c.spentKrw / c.budgetKrw) * 100)) : 0;
            return (
              <li key={c.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{c.brand}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.txt}</span>
                </div>
                <p className="text-[11px] text-ink-3">{c.giftName} · CPA {c.cpaKrw.toLocaleString("ko-KR")}원 · 1인 {c.perUserLimit}회</p>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs">
                  <b className="text-indigo-700">{c.spentKrw.toLocaleString("ko-KR")}원</b>
                  <span className="text-ink-3"> / 예산 {c.budgetKrw.toLocaleString("ko-KR")}원 · 상환 {c.redeemedCount}건</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.status === "active" && (
                    <button type="button" disabled={busy} onClick={() => op(c.id, "pause")} className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-2">일시중지</button>
                  )}
                  {c.status === "paused" && (
                    <button type="button" disabled={busy} onClick={() => op(c.id, "resume")} className="rounded-lg border border-indigo-300 px-2.5 py-1 text-xs text-indigo-600">재개</button>
                  )}
                  {c.status !== "ended" && (
                    <>
                      <button type="button" disabled={busy} onClick={() => op(c.id, "topup", 100000)} className="rounded-lg border border-indigo-300 px-2.5 py-1 text-xs text-indigo-600">+예산 10만</button>
                      <button type="button" disabled={busy} onClick={() => op(c.id, "end")} className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-3">종료</button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
