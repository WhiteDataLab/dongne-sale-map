"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 마이페이지: 내 리뷰 삭제. */
export function DeleteReviewButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const del = async () => {
    if (!window.confirm("이 리뷰를 삭제할까요? 적립 포인트도 함께 회수돼요.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        window.alert("삭제에 실패했어요.");
      }
    } catch {
      window.alert("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={del}
      disabled={busy}
      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:text-ink-4"
    >
      {busy ? "삭제 중…" : "삭제"}
    </button>
  );
}
