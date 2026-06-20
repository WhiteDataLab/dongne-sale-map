"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { reviewDateLabel } from "@/lib/format";
import type { StoreTier } from "@/lib/pro";
import type { SaleDTO } from "@/lib/types";

type AlertRow = { id: string; kind: "sale" | "notice"; title: string; body: string; createdAt: string };
type AlertInfo = {
  tier: StoreTier;
  canSend: boolean;
  sentThisMonth: number;
  monthlyLimit: number | null;
  remaining: number | null; // null=무제한
  favoriteCount: number;
  alerts: AlertRow[];
};

/**
 * M9 — 사장님 세일/소식 알림 발송 패널(라이트+).
 * 즐겨찾기 손님에게 인앱 알림함으로 전달된다. 라이트 월 4회 / 프로 무제한.
 */
export function MerchantAlerts({
  storeId,
  sales,
  onToast,
}: {
  storeId: string;
  sales: SaleDTO[];
  onToast: (m: string) => void;
}) {
  const [info, setInfo] = useState<AlertInfo | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saleId, setSaleId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/stores/${storeId}/alerts`);
      if (res.ok) setInfo((await res.json()) as AlertInfo);
    } catch {
      /* ignore */
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      onToast("제목·내용을 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          kind: saleId ? "sale" : "notice",
          saleId: saleId || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; favoriteCount?: number };
      if (!res.ok) {
        onToast(data.error ?? "발송에 실패했어요.");
        return;
      }
      onToast(
        data.favoriteCount
          ? `즐겨찾기 손님 ${data.favoriteCount}명에게 알림을 보냈어요.`
          : "알림을 보냈어요. (아직 즐겨찾기한 손님이 없어요)",
      );
      setTitle("");
      setBody("");
      setSaleId("");
      load();
    } finally {
      setBusy(false);
    }
  };

  if (!info) return <p className="py-8 text-center text-sm text-ink-3">불러오는 중…</p>;

  // 라이트 미만 → 업그레이드 유도
  if (!info.canSend) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
        <p className="text-2xl">🔔</p>
        <p className="mt-1 text-sm font-semibold">세일 알림 발송은 라이트 플랜부터예요</p>
        <p className="mt-1 text-xs text-ink-3">
          우리 가게를 즐겨찾기한 단골에게 세일·소식을 바로 알릴 수 있어요. 손님이 찾아오길 기다리지 말고 <b>먼저 손을 뻗어보세요.</b>
        </p>
        <Link
          href={`/stores/${storeId}/sponsor`}
          className="mt-3 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          라이트 시작하기 (14일 무료) →
        </Link>
      </div>
    );
  }

  const remainingLabel =
    info.remaining === null ? "무제한" : `이번 달 ${info.remaining}회 남음 (월 ${info.monthlyLimit}회)`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs">
        <span className="text-emerald-700">📨 발송 가능: <b>{remainingLabel}</b></span>
        <span className="text-ink-3">즐겨찾기 손님 {info.favoriteCount}명</span>
      </div>

      <div className="rounded-xl border border-line p-3">
        <p className="mb-1.5 text-xs font-semibold text-ink-3">알림 보내기</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="제목 (예: 오늘 저녁 떨이 시작!)"
          className="w-full rounded-md border border-line px-2.5 py-2 text-sm focus:border-emerald-400 focus:outline-none"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="내용 (예: 삼겹살 1근 9,900원, 선착순이에요)"
          className="mt-1.5 w-full resize-none rounded-md border border-line px-2.5 py-2 text-sm focus:border-emerald-400 focus:outline-none"
        />
        {sales.length > 0 && (
          <select
            value={saleId}
            onChange={(e) => setSaleId(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-line px-2 py-2 text-sm text-ink-2 focus:border-emerald-400 focus:outline-none"
          >
            <option value="">세일 연동 안 함 (일반 소식)</option>
            {sales.map((s) => (
              <option key={s.id} value={s.id}>
                🔥 {s.title} ({s.salePrice.toLocaleString("ko-KR")}원)
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={send}
          disabled={busy || (info.remaining !== null && info.remaining <= 0)}
          className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "보내는 중…" : info.remaining !== null && info.remaining <= 0 ? "이번 달 한도 소진" : "📣 알림 보내기"}
        </button>
      </div>

      {info.alerts.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-3">보낸 알림</p>
          <ul className="flex flex-col gap-1.5">
            {info.alerts.map((a) => (
              <li key={a.id} className="rounded-lg border border-line-2 bg-surface-2 p-2">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-ink">
                    {a.kind === "sale" ? "🔥" : "📣"} {a.title}
                  </p>
                  <span className="shrink-0 text-[11px] text-ink-3">{reviewDateLabel(a.createdAt)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{a.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
