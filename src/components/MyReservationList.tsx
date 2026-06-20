"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORY_META } from "@/lib/constants";
import { won } from "@/lib/format";
import { Countdown } from "@/components/Countdown";
import type { ReservationDTO } from "@/lib/reservations";

/** M7(L2) — 내 예약함(클라이언트). 진행중 예약은 매장에서 픽업코드로 수령(현장결제). */
export function MyReservationList({ initial }: { initial: ReservationDTO[] }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2400);
  };

  async function cancel(id: string) {
    if (!window.confirm("예약을 취소할까요?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/reservations/${id}/cancel`, { method: "POST" });
      if (res.ok) {
        showToast("예약을 취소했어요.");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error ?? "취소에 실패했어요.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (initial.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
        아직 예약한 떨이가 없어요.
        <br />
        지도에서 가게를 열고 마감임박 세일을 <b>픽업 예약</b>해 보세요 🏃
      </p>
    );
  }

  const active = initial.filter((r) => r.status === "reserved");
  const done = initial.filter((r) => r.status !== "reserved");

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <p className="rounded-lg bg-gray-900 px-3 py-2 text-center text-xs text-white">{toast}</p>
      )}
      {active.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-rose-600">픽업 대기 ({active.length})</h2>
          {active.map((r) => (
            <ReservationCard key={r.id} r={r} busy={busy === r.id} onCancel={() => cancel(r.id)} />
          ))}
        </section>
      )}
      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-3">지난 예약 ({done.length})</h2>
          {done.map((r) => (
            <ReservationCard key={r.id} r={r} busy={false} />
          ))}
        </section>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<ReservationDTO["status"], { text: string; cls: string }> = {
  reserved: { text: "픽업 대기", cls: "bg-rose-50 text-rose-600" },
  picked_up: { text: "픽업 완료", cls: "bg-green-50 text-green-600" },
  canceled: { text: "취소됨", cls: "bg-surface-2 text-ink-3" },
  no_show: { text: "노쇼", cls: "bg-surface-2 text-ink-3" },
};

function ReservationCard({
  r,
  busy,
  onCancel,
}: {
  r: ReservationDTO;
  busy: boolean;
  onCancel?: () => void;
}) {
  const meta = CATEGORY_META[r.category];
  const badge = STATUS_LABEL[r.status];
  const active = r.status === "reserved";
  return (
    <div className="overflow-hidden rounded-xl border border-line-2">
      <div className="flex gap-3 p-3">
        {r.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>
              {badge.text}
            </span>
            <Link href={`/?store=${r.storeId}`} className="truncate text-xs text-ink-3 hover:underline">
              {meta?.icon} {r.storeName}
            </Link>
          </div>
          <p className="mt-0.5 truncate text-sm font-medium">{r.saleTitle}</p>
          <p className="text-xs text-ink-3">
            {won(r.unitPriceKrw)} × {r.qty}개 = <b className="text-ink">{won(r.amountKrw)}</b>
          </p>
          {active && (
            <p className="mt-0.5 text-xs">
              <Countdown to={r.expiresAt} className="font-medium text-orange-600" /> 까지 픽업
            </p>
          )}
        </div>
      </div>
      {active && (
        <div className="flex items-center justify-between gap-2 border-t border-line-2 bg-surface-2 px-3 py-2">
          <div className="text-xs text-ink-3">
            예약번호 <span className="font-mono text-base font-bold tracking-widest text-ink">{r.pickupCode}</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1 text-xs text-ink-2 disabled:opacity-50"
          >
            예약 취소
          </button>
        </div>
      )}
      {r.pickupInfo && active && (
        <p className="border-t border-line-2 px-3 py-2 text-[11px] text-ink-3">📍 {r.pickupInfo}</p>
      )}
    </div>
  );
}
