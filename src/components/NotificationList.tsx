"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { reviewDateLabel } from "@/lib/format";

export type NotificationItem = {
  id: string;
  icon: string;
  title: string;
  body: string;
  href: string;
  createdAt: string; // ISO
};

const SEEN_KEY = "notif_seen_at";

/** 알림 목록 — localStorage로 마지막 확인 시각을 저장해 새 알림을 강조(읽음 표시). */
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const [seenAt, setSeenAt] = useState<number | null>(null);

  useEffect(() => {
    const prev = Number(localStorage.getItem(SEEN_KEY) || 0);
    setSeenAt(prev);
    // 방문 즉시 '확인함'으로 갱신
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  }, []);

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
        새로운 알림이 없어요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((n) => {
        const isNew = seenAt !== null && new Date(n.createdAt).getTime() > seenAt;
        return (
          <li key={n.id}>
            <Link
              href={n.href}
              className={[
                "flex gap-3 rounded-xl border p-3 transition-colors hover:bg-surface-2",
                isNew ? "border-brand/40 bg-brand-wash/40" : "border-line",
              ].join(" ")}
            >
              <span className="text-xl" aria-hidden>
                {n.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-ink">{n.title}</p>
                  {isNew && <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />}
                </div>
                <p className="line-clamp-2 text-sm text-ink-3">{n.body}</p>
                <p className="mt-0.5 text-xs text-ink-3">{reviewDateLabel(n.createdAt)}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
