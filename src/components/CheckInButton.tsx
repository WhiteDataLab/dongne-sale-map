"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 출석체크 버튼. POST /api/checkin → 결과 안내 + 새로고침. */
export function CheckInButton({
  checkedToday,
  dailyPoint = 10,
}: {
  checkedToday: boolean;
  dailyPoint?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const checkIn = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/checkin", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        awarded?: { total: number; weekly: number; monthly: number };
        streak?: number;
      };
      if (!res.ok) {
        setMsg(res.status === 401 ? "로그인이 필요해요." : data.error ?? "출석에 실패했어요.");
        return;
      }
      const bonus =
        (data.awarded?.weekly ? ` (주간 +${data.awarded.weekly}P)` : "") +
        (data.awarded?.monthly ? ` (월간 +${data.awarded.monthly}P)` : "");
      setMsg(`출석 완료! +${data.awarded?.total ?? dailyPoint}P${bonus} · ${data.streak}일 연속 🔥`);
      router.refresh();
    } catch {
      setMsg("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (checkedToday) {
    return (
      <div className="rounded-xl bg-green-50 py-3 text-center text-sm font-semibold text-green-700">
        ✅ 오늘 출석 완료! 내일 또 만나요
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={checkIn}
        disabled={busy}
        className="w-full rounded-xl bg-brand py-3.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-brand-ink active:bg-blue-800 disabled:bg-gray-300"
      >
        {busy ? "처리 중…" : `오늘 출석체크하고 +${dailyPoint}P 받기`}
      </button>
      {msg && <p className="mt-2 text-center text-sm text-ink-3">{msg}</p>}
    </div>
  );
}
