"use client";

import { useState } from "react";

/** 리뷰 좋아요/싫어요 토글 버튼. 자체 상태로 즉시 반영. */
export function ReviewReactions({
  reviewId,
  likeCount,
  dislikeCount,
  myReaction,
  onToast,
}: {
  reviewId: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: "like" | "dislike" | null;
  onToast?: (msg: string) => void;
}) {
  const [like, setLike] = useState(likeCount);
  const [dislike, setDislike] = useState(dislikeCount);
  const [mine, setMine] = useState<"like" | "dislike" | null>(myReaction);
  const [busy, setBusy] = useState(false);

  const react = async (kind: "like" | "dislike") => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (res.status === 401) {
        onToast?.("로그인이 필요해요.");
        return;
      }
      const d = (await res.json().catch(() => ({}))) as {
        likeCount?: number;
        dislikeCount?: number;
        myReaction?: "like" | "dislike" | null;
      };
      if (res.ok) {
        setLike(d.likeCount ?? like);
        setDislike(d.dislikeCount ?? dislike);
        setMine(d.myReaction ?? null);
      }
    } catch {
      onToast?.("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => react("like")}
        disabled={busy}
        className={[base, mine === "like" ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-500"].join(" ")}
      >
        👍 {like}
      </button>
      <button
        type="button"
        onClick={() => react("dislike")}
        disabled={busy}
        className={[base, mine === "dislike" ? "border-red-400 bg-red-50 text-red-500" : "border-gray-200 text-gray-500"].join(" ")}
      >
        👎 {dislike}
      </button>
    </div>
  );
}
