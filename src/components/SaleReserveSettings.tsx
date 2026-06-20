"use client";

import { useState } from "react";
import type { SaleDTO } from "@/lib/types";

/**
 * M7(L2) — 사장님: 세일별 '픽업 예약 받기' 설정(수량·픽업안내).
 * PATCH /api/sales/[id] (canManageStore). 켜면 소비자가 앱에서 선점(현장결제) 가능.
 */
export function SaleReserveSettings({
  sale,
  onToast,
  onDone,
}: {
  sale: SaleDTO;
  onToast: (m: string) => void;
  onDone: () => void;
}) {
  const info = sale.reservation;
  const [open, setOpen] = useState(false);
  const [stock, setStock] = useState(String(info?.stockTotal ?? 5));
  const [pickupInfo, setPickupInfo] = useState(info?.pickupInfo ?? "");
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onToast(okMsg);
        onDone();
      } else {
        const d = await res.json().catch(() => ({}));
        onToast(d.error ?? "설정에 실패했어요.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (info) {
    // 이미 예약 받는 세일 — 현황 + 끄기.
    return (
      <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50/50 p-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-medium text-rose-700">🏃 픽업 예약 받는 중</span>
          <button
            type="button"
            onClick={() => patch({ reservable: false }, "픽업 예약을 껐어요.")}
            disabled={busy}
            className="text-ink-3 underline disabled:opacity-50"
          >
            끄기
          </button>
        </div>
        <p className="mt-1 text-ink-2">
          총 {info.stockTotal}개 중 남은 수량 <b>{info.remaining}개</b>
          {info.soldOut && <span className="ml-1 text-rose-600">(마감)</span>}
        </p>
        {info.pickupInfo && <p className="mt-0.5 text-ink-3">📍 {info.pickupInfo}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-lg border border-dashed border-rose-300 py-1.5 text-xs font-medium text-rose-600"
      >
        🏃 픽업 예약 받기
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50/50 p-2.5">
      <p className="text-xs font-medium text-rose-700">픽업 예약 받기</p>
      <label className="mt-2 block text-[11px] text-ink-3">
        예약 받을 수량
        <input
          type="number"
          min={1}
          max={9999}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-line px-2 py-1 text-sm"
        />
      </label>
      <label className="mt-2 block text-[11px] text-ink-3">
        픽업 안내 (선택)
        <input
          type="text"
          value={pickupInfo}
          maxLength={200}
          placeholder="예: 오늘 20시까지 카운터에서 픽업"
          onChange={(e) => setPickupInfo(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-line px-2 py-1 text-sm"
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2"
        >
          취소
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const n = Number(stock);
            if (!Number.isInteger(n) || n < 1) {
              onToast("수량을 확인해 주세요.");
              return;
            }
            patch(
              { reservable: true, stockTotal: n, pickupInfo: pickupInfo.trim() || null },
              "픽업 예약을 켰어요.",
            );
          }}
          className="flex-1 rounded-lg bg-rose-600 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "저장 중…" : "예약 받기 시작"}
        </button>
      </div>
    </div>
  );
}
