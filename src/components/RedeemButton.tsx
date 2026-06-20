"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** 기프티콘 교환 버튼. 포인트 차감 → 등록 연락처로 발송(관리자 수동). */
export function RedeemButton({
  itemId,
  points,
  affordable,
}: {
  itemId: string;
  points: number;
  affordable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "contact"; text: string } | null>(null);

  const redeem = async () => {
    if (!window.confirm(`${points.toLocaleString("ko-KR")}P로 교환할까요?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        needContact?: boolean;
      };
      if (!res.ok) {
        if (data.needContact) {
          setMsg({ kind: "contact", text: data.error ?? "연락처 등록이 필요해요." });
        } else {
          setMsg({ kind: "err", text: res.status === 401 ? "로그인이 필요해요." : data.error ?? "교환 실패" });
        }
        return;
      }
      setMsg({ kind: "ok", text: data.message ?? "교환 완료!" });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "네트워크 오류가 발생했어요." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={redeem}
        disabled={busy || !affordable}
        className={[
          "w-full rounded-lg py-2 text-sm font-semibold transition-colors",
          affordable
            ? "bg-brand text-white hover:bg-brand-ink disabled:bg-gray-300"
            : "cursor-not-allowed bg-surface-2 text-ink-3",
        ].join(" ")}
      >
        {busy ? "처리 중…" : affordable ? "교환하기" : "포인트 부족"}
      </button>
      {msg && (
        <p
          className={[
            "mt-1 text-center text-xs",
            msg.kind === "ok" ? "text-green-600" : msg.kind === "contact" ? "text-amber-600" : "text-red-500",
          ].join(" ")}
        >
          {msg.text}
          {msg.kind === "contact" && (
            <>
              {" "}
              <Link href="/account#contact" className="font-semibold underline">
                연락처 등록하러 가기
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
