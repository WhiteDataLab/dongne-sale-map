"use client";

import { useCallback, useEffect, useState } from "react";
import { won } from "@/lib/format";
import { Countdown } from "@/components/Countdown";
import type { ReservationDTO } from "@/lib/reservations";

/**
 * M7(L2) — 사장님 대시보드 '예약' 섹션. 들어온 픽업 예약을 보고
 * 픽업 완료 / 노쇼 / 취소 처리(쿠폰 use 와 동일한 매장 자기처리 모델).
 */
export function MerchantReservations({
  storeId,
  onToast,
}: {
  storeId: string;
  onToast: (m: string) => void;
}) {
  const [rows, setRows] = useState<ReservationDTO[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/stores/${storeId}/reservations`);
      if (res.ok) {
        const d = await res.json();
        setRows(d.reservations ?? []);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "pickup" | "noshow" | "cancel", label: string) {
    if (action !== "pickup" && !window.confirm(`이 예약을 ${label} 처리할까요?`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/reservations/${id}/${action}`, { method: "POST" });
      if (res.ok) {
        onToast(`${label} 처리했어요.`);
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        onToast(d.error ?? "처리에 실패했어요.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) return <p className="text-sm text-ink-3">불러오는 중…</p>;

  const waiting = rows.filter((r) => r.status === "reserved");
  const done = rows.filter((r) => r.status !== "reserved");

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
        아직 들어온 예약이 없어요.
        <br />
        세일/행사 탭에서 마감임박 떨이에 <b>픽업 예약 받기</b>를 켜보세요 🏃
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {waiting.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-rose-600">픽업 대기 ({waiting.length})</h3>
          {waiting.map((r) => (
            <div key={r.id} className="rounded-xl border border-rose-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.saleTitle}</p>
                  <p className="text-xs text-ink-3">
                    {won(r.unitPriceKrw)} × {r.qty}개 = <b className="text-ink">{won(r.amountKrw)}</b>
                    <span className="ml-1 text-ink-3">(수수료 {won(r.feeKrw)})</span>
                  </p>
                  <p className="mt-0.5 text-xs">
                    <Countdown to={r.expiresAt} className="font-medium text-orange-600" /> 까지 픽업
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] text-ink-3">예약번호</span>
                  <p className="font-mono text-lg font-bold tracking-widest">{r.pickupCode}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => act(r.id, "pickup", "픽업 완료")}
                  disabled={busy === r.id}
                  className="flex-1 rounded-lg bg-green-600 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  ✓ 픽업 완료
                </button>
                <button
                  type="button"
                  onClick={() => act(r.id, "noshow", "노쇼")}
                  disabled={busy === r.id}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 disabled:opacity-50"
                >
                  노쇼
                </button>
                <button
                  type="button"
                  onClick={() => act(r.id, "cancel", "취소")}
                  disabled={busy === r.id}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink-3">지난 예약 ({done.length})</h3>
          {done.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-line-2 px-3 py-2 text-xs">
              <span className="truncate">{r.saleTitle}</span>
              <span className="shrink-0 text-ink-3">
                {r.qty}개 · {STATUS_TEXT[r.status]}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

const STATUS_TEXT: Record<ReservationDTO["status"], string> = {
  reserved: "대기",
  picked_up: "픽업 완료",
  canceled: "취소",
  no_show: "노쇼",
};
