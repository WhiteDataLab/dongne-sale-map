"use client";

import { useState } from "react";
import type { ReviewReplyDTO } from "@/lib/types";
import type { StoreTier } from "@/lib/pro";
import { ReportButton } from "./ReportButton";

/**
 * M8 — 리뷰 답글 표시 + (사장님/관리자) 인라인 작성/수정/삭제.
 * 소비자에겐 답글이 있으면 읽기 전용으로 보인다. 관리자에겐 작성 UI를 노출하되
 * 가게 기능 티어가 라이트 미만이면 업그레이드 안내만 보여준다.
 */
export function ReviewReplyBox({
  reviewId,
  storeId,
  reply,
  canManage,
  tier,
  onToast,
  onChanged,
}: {
  reviewId: string;
  storeId: string;
  reply: ReviewReplyDTO | null;
  canManage: boolean;
  tier: StoreTier;
  onToast?: (m: string) => void;
  onChanged?: () => void;
}) {
  const liteOk = tier === "lite" || tier === "pro";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reply?.body ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onToast?.(data.error ?? "답글 저장에 실패했어요.");
        return;
      }
      setEditing(false);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/reply`, { method: "DELETE" });
      if (!res.ok) {
        onToast?.("답글 삭제에 실패했어요.");
        return;
      }
      setText("");
      setEditing(false);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  // 작성/수정 폼
  if (editing) {
    return (
      <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="고객님께 답글을 남겨보세요"
          className="w-full resize-none rounded-md border border-line p-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <div className="mt-1.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setText(reply?.body ?? "");
            }}
            className="text-xs text-ink-3"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !text.trim()}
            className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "저장 중…" : "등록"}
          </button>
        </div>
      </div>
    );
  }

  // 답글 있음 → 박스 + (관리자) 수정/삭제
  if (reply) {
    return (
      <div className="mt-2 rounded-lg border border-line-2 bg-surface-2 p-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-indigo-700">🏪 사장님 답글</p>
          {/* 소비자는 답글 신고 가능(사장님 본인은 제외) */}
          {!canManage && onToast && (
            <ReportButton targetType="reply" targetId={reply.id} onToast={onToast} onChanged={onChanged} />
          )}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-2">{reply.body}</p>
        {canManage && (
          <div className="mt-1 flex items-center gap-3">
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-brand">
              수정
            </button>
            <button type="button" onClick={remove} disabled={busy} className="text-xs text-red-500">
              삭제
            </button>
          </div>
        )}
      </div>
    );
  }

  // 답글 없음 → 관리자에게만 작성 진입점(티어 게이팅)
  if (!canManage) return null;
  if (!liteOk) {
    return (
      <a href={`/stores/${storeId}/sponsor`} className="mt-1.5 inline-block text-xs text-ink-3 hover:text-indigo-600">
        💬 리뷰 답글은 <b>라이트 플랜</b>부터 — 업그레이드
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mt-1.5 text-xs font-medium text-indigo-600 hover:underline"
    >
      💬 답글 달기
    </button>
  );
}
