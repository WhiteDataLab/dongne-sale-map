"use client";

import { useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import type { SaleDTO } from "@/lib/types";
import { Countdown } from "./Countdown";

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
  // 가격 미입력(원탭 제보) 세일은 금액 확정 불가 → 예약 UI 미노출(서버도 409 가드)
  if (!info || sale.salePrice == null) return null;

  const max = Math.min(10, info.remaining ?? 10);

  if (info.myActiveReservationId) {
    return (
      <div className="mt-2 rounded-xl bg-deal-wash px-3 py-2 text-xs font-semibold text-deal-ink">
        🏃 예약 완료! 매장에서 픽업하세요.{" "}
        <Link href="/reservations" className="font-bold underline">
          내 예약 보기
        </Link>
      </div>
    );
  }

  if (info.soldOut) {
    return (
      <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-center text-xs font-semibold text-ink-4">
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
    <div className="mt-2 rounded-xl border border-deal/40 bg-deal-wash/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-deal-ink">🏃 픽업 예약</span>
        {info.remaining != null && (
          <span className="num rounded-full bg-deal-wash px-2 py-0.5 text-[11px] font-extrabold text-deal-ink">
            {info.remaining}개 남음
          </span>
        )}
      </div>
      <p className="mt-1 text-xs font-semibold text-deal-ink">
        ⏰ <Countdown to={sale.expiresAt} /> 후 픽업 마감
      </p>
      {info.pickupInfo && <p className="mt-1 text-[11px] font-medium text-ink-3">📍 {info.pickupInfo}</p>}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-line bg-white">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-2.5 py-1 text-ink-2 disabled:opacity-40"
            disabled={qty <= 1}
            aria-label="수량 감소"
          >
            −
          </button>
          <span className="num w-6 text-center text-sm font-bold text-ink">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            className="px-2.5 py-1 text-ink-2 disabled:opacity-40"
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
          style={{ background: "var(--deal-grad)" }}
          className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-[0_6px_16px_rgba(255,59,48,0.26)] disabled:opacity-50"
        >
          {busy ? "예약 중…" : `${won(sale.salePrice * qty)} 예약하고 픽업`}
        </button>
      </div>
      <p className="mt-1.5 text-center text-[11px] font-medium text-ink-4">결제는 매장에서 현장결제예요.</p>
    </div>
  );
}
