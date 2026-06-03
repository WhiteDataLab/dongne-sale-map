"use client";

import { useState } from "react";

/** 리뷰 작성/평점 폼 (스펙 Phase 3). */
export function ReviewForm({
  storeId,
  onDone,
  onCancel,
  onToast,
}: {
  storeId: string;
  onDone: () => void;
  onCancel: () => void;
  onToast: (msg: string) => void;
}) {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!content.trim()) return onToast("리뷰 내용을 입력해 주세요.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, rating, content: content.trim() }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        onToast(res.status === 401 ? "로그인이 필요해요." : e.error ?? "등록 실패");
        return;
      }
      onToast("리뷰가 등록됐어요. 고마워요!");
      onDone();
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">리뷰 쓰기</h4>
        <button type="button" onClick={onCancel} className="text-sm text-gray-400">
          닫기
        </button>
      </div>

      <div className="flex gap-1 text-2xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n}점`}
            onClick={() => setRating(n)}
            className={n <= rating ? "text-amber-500" : "text-gray-300"}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="가게는 어땠나요?"
        className="resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:bg-gray-300"
      >
        {submitting ? "등록 중…" : "리뷰 등록"}
      </button>
    </div>
  );
}
