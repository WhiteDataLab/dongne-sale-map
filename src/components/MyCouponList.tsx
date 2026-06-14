"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORY_META } from "@/lib/constants";
import type { MyCouponDTO } from "@/lib/coupons";

/** M3 — 내 쿠폰함 목록(클라이언트). 사용가능 쿠폰은 매장에서 '사용하기'로 자기처리. */
export function MyCouponList({ initial }: { initial: MyCouponDTO[] }) {
  const [toast, setToast] = useState<string | null>(null);

  if (initial.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
        아직 받은 쿠폰이 없어요.
        <br />
        지도에서 가게를 열고 ‘쿠폰’ 탭에서 받아보세요 🎟️
      </p>
    );
  }

  // 사용 가능(미사용·유효) → 위로, 그다음 사용완료·만료
  const usable = initial.filter((c) => c.status === "claimed" && !c.expired);
  const done = initial.filter((c) => !(c.status === "claimed" && !c.expired));

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <p className="rounded-lg bg-gray-900 px-3 py-2 text-center text-xs text-white">{toast}</p>
      )}
      {usable.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-rose-600">사용 가능 ({usable.length})</h2>
          {usable.map((c) => (
            <MyCouponCard key={c.claimId} coupon={c} onToast={setToast} />
          ))}
        </section>
      )}
      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-400">지난 쿠폰 ({done.length})</h2>
          {done.map((c) => (
            <MyCouponCard key={c.claimId} coupon={c} onToast={setToast} />
          ))}
        </section>
      )}
    </div>
  );
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function MyCouponCard({
  coupon,
  onToast,
}: {
  coupon: MyCouponDTO;
  onToast: (msg: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmUse, setConfirmUse] = useState(false);

  const usable = coupon.status === "claimed" && !coupon.expired;
  const dim = !usable;

  const use = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/coupons/${coupon.couponId}/use`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onToast(data.error || "사용 처리에 실패했어요.");
        return;
      }
      onToast("쿠폰을 사용했어요! 🎉");
      router.refresh();
    } catch {
      onToast("네트워크 오류예요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`overflow-hidden rounded-xl border ${dim ? "border-gray-200" : "border-rose-200"}`}>
      <div className="flex items-stretch">
        <div className={`w-2 ${dim ? "bg-gray-300" : "bg-rose-500"}`} aria-hidden />
        <div className={`min-w-0 flex-1 p-3 ${dim ? "opacity-60" : ""}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">🎟️ {coupon.title}</p>
              <Link
                href={`/?store=${coupon.storeId}`}
                className="mt-0.5 inline-block truncate text-xs text-gray-500 hover:underline"
              >
                {CATEGORY_META[coupon.category].icon} {coupon.storeName}
              </Link>
              {coupon.condition && (
                <p className="mt-0.5 truncate text-xs text-gray-400">{coupon.condition}</p>
              )}
            </div>
            {coupon.status === "used" ? (
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-400">
                사용완료
              </span>
            ) : coupon.expired ? (
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-400">
                만료
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400">
              {coupon.status === "used" && coupon.usedAt
                ? `${dateLabel(coupon.usedAt)} 사용`
                : `~${dateLabel(coupon.expiresAt)}까지`}
            </p>
            {usable &&
              (confirmUse ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={use}
                    className="rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-600 disabled:opacity-50"
                  >
                    사장님 확인, 사용!
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmUse(false)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] text-gray-500"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmUse(true)}
                  className="shrink-0 rounded-lg bg-rose-500 px-3 py-1 text-xs font-bold text-white hover:bg-rose-600"
                >
                  사용하기
                </button>
              ))}
          </div>
          {confirmUse && (
            <p className="mt-1 text-[11px] text-rose-500">
              매장에서 사장님께 이 화면을 보여준 뒤 눌러주세요. (되돌릴 수 없어요)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
