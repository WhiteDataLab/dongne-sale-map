"use client";

import { useState } from "react";

type TargetType = "store" | "sale" | "review" | "product" | "reply";

/**
 * 신고 진입점 (스펙 Phase 4). 작은 "신고" 버튼 → 사유 입력 → /api/reports.
 * 누적 임계치 도달 시 서버가 자동 숨김 처리하며, 그 경우 안내 후 목록을 새로고침한다.
 */
export function ReportButton({
  targetType,
  targetId,
  onToast,
  onChanged,
  label = "신고",
}: {
  targetType: TargetType;
  targetId: string;
  onToast: (msg: string) => void;
  onChanged?: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return onToast("신고 사유를 입력해 주세요.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason: reason.trim() }),
      });
      if (!res.ok) {
        onToast(res.status === 401 ? "로그인이 필요해요." : "신고 접수에 실패했어요.");
        return;
      }
      const { hidden } = (await res.json()) as { hidden?: boolean };
      onToast(
        hidden
          ? "신고 누적으로 자동 숨김 처리됐어요."
          : "신고가 접수됐어요. 검토 후 처리돼요.",
      );
      setOpen(false);
      setReason("");
      onChanged?.();
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="inline-flex items-center text-gray-400 transition-colors hover:text-red-500"
      >
        {/* 신고 아이콘 (깃발) */}
        <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
          <path
            d="M5 21V4m0 0h11l-1.5 3L16 10H5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="신고 사유"
        className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
        autoFocus
      />
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="shrink-0 rounded bg-red-500 px-2 py-1 text-xs text-white disabled:bg-gray-300"
      >
        접수
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="shrink-0 text-xs text-gray-400"
      >
        취소
      </button>
    </div>
  );
}
