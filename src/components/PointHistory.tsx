"use client";

import { useState } from "react";

type Item = { id: string; amount: number; reason: string; date: string };

const PREVIEW = 5; // 접힌 상태
const PAGE = 10; // 펼친 뒤 한 페이지

/** 포인트 내역: 처음 5줄 → 펼치면 10줄씩 페이지네이션(최대 2년치). */
export function PointHistory({ items }: { items: Item[] }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-3">
        최근 2년간 적립 내역이 없어요.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE));
  const shown = expanded ? items.slice(page * PAGE, page * PAGE + PAGE) : items.slice(0, PREVIEW);

  return (
    <div>
      <ul className="flex flex-col divide-y divide-line-2 rounded-xl border border-line">
        {shown.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm">{h.reason}</p>
              <p className="text-xs text-ink-3">{h.date}</p>
            </div>
            <span className={`shrink-0 text-sm font-semibold ${h.amount < 0 ? "text-red-500" : "text-brand"}`}>
              {h.amount > 0 ? "+" : ""}
              {h.amount}P
            </span>
          </li>
        ))}
      </ul>

      {!expanded && items.length > PREVIEW && (
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setPage(0);
          }}
          className="mt-2 w-full rounded-lg border border-line py-2 text-sm font-medium text-ink-2 hover:bg-surface-2"
        >
          펼쳐서 보기 (전체 {items.length}건)
        </button>
      )}

      {expanded && (
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              setPage(0);
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-3 hover:bg-surface-2"
          >
            접기
          </button>

          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-line px-2.5 py-1 font-medium text-ink-2 disabled:text-ink-4 hover:enabled:bg-surface-2"
              >
                이전
              </button>
              <span className="tabular-nums text-ink-3">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-line px-2.5 py-1 font-medium text-ink-2 disabled:text-ink-4 hover:enabled:bg-surface-2"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
