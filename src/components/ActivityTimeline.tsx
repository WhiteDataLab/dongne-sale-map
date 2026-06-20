"use client";

import { useState } from "react";
import Link from "next/link";
import { ymd } from "@/lib/format";

export type ActivityItem = {
  id: string;
  icon: string;
  text: string;
  href: string;
  date: string; // ISO
};

const PREVIEW = 5;
const PAGE = 10;

/** 내 활동: 처음 5건 → 펼치면 10건씩 페이지네이션. 날짜는 정확한 년월일(본인용). */
export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  if (items.length === 0) return null;

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE));
  const shown = expanded ? items.slice(page * PAGE, page * PAGE + PAGE) : items.slice(0, PREVIEW);

  return (
    <div>
      <ul className="flex flex-col divide-y divide-line-2 rounded-xl border border-line">
        {shown.map((t) => (
          <li key={t.id}>
            <Link href={t.href} className="flex items-center gap-2 px-3 py-2.5 hover:bg-surface-2">
              <span aria-hidden>{t.icon}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{t.text}</span>
              <span className="shrink-0 text-xs text-ink-3">{ymd(t.date)}</span>
            </Link>
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
