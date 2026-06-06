"use client";

import { useState } from "react";

/** 버튼/태깅 리뷰 프리셋. 누르면 선택되고, 여러 개 선택 가능. */
const REVIEW_TAGS = [
  "재료가 신선해요",
  "양이 많아요",
  "가성비가 좋아요",
  "메뉴 구성이 알차요",
  "고기 질이 좋아요",
  "비싼 만큼 가치있어요",
  "인테리어가 멋져요",
];

/** 리뷰 작성/평점 폼 (스펙 Phase 3 + 태깅 리뷰). */
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
  const [selected, setSelected] = useState<string[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggle = (tag: string) =>
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  // 최종 리뷰 내용 = 선택 태그 + (기타) 직접 입력
  const buildContent = () => {
    const parts = [...selected];
    if (showCustom && custom.trim()) parts.push(custom.trim());
    return parts.join(", ");
  };

  const submit = async () => {
    const content = buildContent();
    if (!content) return onToast("태그를 고르거나 ‘기타’로 직접 입력해 주세요.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, rating, content }),
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

      {/* 별점 */}
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

      {/* 태그 버튼 */}
      <div className="flex flex-wrap gap-2">
        {REVIEW_TAGS.map((tag) => {
          const on = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                on
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {tag}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={[
            "rounded-full border px-3 py-1.5 text-sm transition-colors",
            showCustom
              ? "border-gray-800 bg-gray-800 text-white"
              : "border-dashed border-gray-300 bg-white text-gray-500 hover:bg-gray-50",
          ].join(" ")}
        >
          ✏️ 기타
        </button>
      </div>

      {/* 기타: 직접 입력 */}
      {showCustom && (
        <textarea
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          rows={2}
          autoFocus
          placeholder="직접 남기고 싶은 후기를 적어 주세요."
          className="resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
      )}

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
