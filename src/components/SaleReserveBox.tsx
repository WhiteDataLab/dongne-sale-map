"use client";

import { useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import type { SaleDTO } from "@/lib/types";

/**
 * M7(L2) — 가게 상세 세일 항목의 픽업 예약 박스(소비자).
 * v1=현장결제 — 앱에선 선점만(결제는 매장). 남은 수량·수량 선택·예약 버튼.
 * 이미 예약했으면 예약함 링크, 마감이면 비활성.
 */
export function SaleReserveBox({
  sale,
  onToast,
  onDone,
}: {
  sale: SaleDTO;
  onToast: (m: string) => void;
  onDone: () => void;
}) {
  const info = sale.reservation;
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  if (!info) return null;

  const max = Math.min(10, info.remaining ?? 10);

  if (info.myActiveReservationId) {
    return (
      <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
        🏃 예약 완료! 매장에서 픽업하세요.{" "}
        <Link href="/reservations" className="font-bold underline">
          내 예약 보기
        </Link>
      </div>
    );
  }

  if (info.soldOut) {
    return (
      <div className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-center text-xs font-medium text-gray-400">
        예약 마감
      </div>
    );
  }

  async function reserve() {
    setBusy(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: sale.id, qty }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        onToast(`예약 완료! 예약번호 ${d.pickupCode}`);
        onDone();
      } else if (res.status === 401) {
        onToast("로그인이 필요해요.");
      } else {
        onToast(d.error ?? "예약에 실패했어요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50/50 p-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-rose-700">🏃 픽업 예약</span>
        {info.remaining != null && <span className="text-gray-500">남은 수량 {info.remaining}개</span>}
      </div>
      {info.pickupInfo && <p className="mt-1 text-[11px] text-gray-500">📍 {info.pickupInfo}</p>}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-gray-300 bg-white">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-2.5 py-1 text-gray-600 disabled:opacity-40"
            disabled={qty <= 1}
            aria-label="수량 감소"
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-medium">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            className="px-2.5 py-1 text-gray-600 disabled:opacity-40"
            disabled={qty >= max}
            aria-label="수량 증가"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={reserve}
          disabled={busy}
          className="flex-1 rounded-lg bg-rose-600 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50"
        >
          {busy ? "예약 중…" : `${won(sale.salePrice * qty)} 예약하기`}
        </button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-gray-400">결제는 매장에서 현장결제예요.</p>
    </div>
  );
}
