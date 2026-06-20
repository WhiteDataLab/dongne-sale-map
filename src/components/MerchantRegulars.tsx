"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { reviewDateLabel } from "@/lib/format";

type Segment = "active" | "at_risk" | "dormant";
type Row = {
  userId: string;
  nickname: string;
  img: string | null;
  score: number;
  segment: Segment;
  lastActivityAt: string;
  signals: { usedCoupons: number; reviews: number; intentVisits: number; directions: number; detailOpens: number };
};
type Info = {
  tier: "free" | "lite" | "pro";
  canCampaign: boolean;
  summary: { total: number; active: number; at_risk: number; dormant: number };
  rows: Row[];
};

const SEG_META: Record<Segment, { label: string; cls: string }> = {
  active: { label: "활성", cls: "bg-green-100 text-green-700" },
  at_risk: { label: "이탈위험", cls: "bg-amber-100 text-amber-700" },
  dormant: { label: "휴면", cls: "bg-gray-200 text-ink-3" },
};

/**
 * M10 — 사장님 단골 CRM(라이트+). 단골 식별·세그먼트 + (프로) 컴백 쿠폰 캠페인.
 * 개인정보: 닉네임·활동 신호만 표시(연락처 미노출).
 */
export function MerchantRegulars({ storeId, onToast }: { storeId: string; onToast: (m: string) => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [gate, setGate] = useState(false);
  const [filter, setFilter] = useState<Segment | "all">("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/stores/${storeId}/regulars`);
      if (res.status === 402) {
        setGate(true);
        return;
      }
      if (res.ok) {
        setGate(false);
        setInfo((await res.json()) as Info);
      }
    } catch {
      /* ignore */
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  if (gate) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
        <p className="text-2xl">🧑‍🤝‍🧑</p>
        <p className="mt-1 text-sm font-semibold">단골 관리는 라이트 플랜부터예요</p>
        <p className="mt-1 text-xs text-ink-3">누가 우리 단골인지, 요즘 안 오는 손님이 누군지 확인하고 다시 부를 수 있어요.</p>
        <Link href={`/stores/${storeId}/sponsor`} className="mt-3 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white">
          라이트 시작하기 (14일 무료) →
        </Link>
      </div>
    );
  }
  if (!info) return <p className="py-8 text-center text-sm text-ink-3">불러오는 중…</p>;

  const rows = filter === "all" ? info.rows : info.rows.filter((r) => r.segment === filter);

  return (
    <div className="flex flex-col gap-3">
      {/* 세그먼트 요약 카드 */}
      <div className="grid grid-cols-3 gap-1.5">
        {(["active", "at_risk", "dormant"] as Segment[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={[
              "rounded-lg px-2 py-2 text-center transition",
              filter === s ? "ring-2 ring-gray-900" : "",
              SEG_META[s].cls,
            ].join(" ")}
          >
            <p className="text-[11px]">{SEG_META[s].label}</p>
            <p className="text-lg font-bold">{info.summary[s]}</p>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ink-3">
        전체 단골 {info.summary.total}명 · 최근 120일 활동 기준 · 점수 = 쿠폰사용·리뷰·방문의향·길찾기·상세열람 가중합
      </p>

      {/* 프로 전용 컴백 캠페인 */}
      {info.canCampaign ? (
        <CampaignBox storeId={storeId} summary={info.summary} onToast={onToast} onDone={load} />
      ) : (
        <div className="rounded-lg bg-indigo-50 p-2.5 text-center text-xs text-indigo-600">
          ⭐ 프로 플랜이면 <b>이탈 단골에게 컴백 쿠폰</b>을 한 번에 보낼 수 있어요.{" "}
          <Link href={`/stores/${storeId}/sponsor`} className="font-bold underline">업그레이드</Link>
        </div>
      )}

      {/* 단골 리스트 */}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
          {filter === "all" ? "아직 단골 데이터가 없어요. 손님 활동이 쌓이면 표시돼요." : "이 세그먼트에 단골이 없어요."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.userId} className="flex items-center gap-2.5 rounded-lg border border-line-2 p-2">
              <div className="size-9 shrink-0 overflow-hidden rounded-full bg-surface-2">
                {r.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.img} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm text-ink-3">🙂</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{r.nickname}</p>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${SEG_META[r.segment].cls}`}>
                    {SEG_META[r.segment].label}
                  </span>
                </div>
                <p className="text-[11px] text-ink-3">
                  최근 활동 {reviewDateLabel(r.lastActivityAt)} · 리뷰 {r.signals.reviews}·쿠폰 {r.signals.usedCoupons}·방문의향 {r.signals.intentVisits}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-ink-2">{r.score}점</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 프로: 컴백 쿠폰 캠페인 작성. */
function CampaignBox({
  storeId,
  summary,
  onToast,
  onDone,
}: {
  storeId: string;
  summary: { active: number; at_risk: number; dormant: number };
  onToast: (m: string) => void;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<Segment>("at_risk");
  const [title, setTitle] = useState("");
  const [condition, setCondition] = useState("");
  const [expiresDays, setExpiresDays] = useState(14);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const targetCount = summary[segment];

  const send = async () => {
    if (!title.trim()) {
      onToast("쿠폰 혜택(제목)을 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/regulars/campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, title, condition: condition || undefined, expiresDays, message: message || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; targeted?: number };
      if (!res.ok) {
        onToast(data.error ?? "캠페인 발송에 실패했어요.");
        return;
      }
      onToast(`단골 ${data.targeted}명에게 컴백 쿠폰을 보냈어요! 🎟️`);
      setOpen(false);
      setTitle("");
      setCondition("");
      setMessage("");
      onDone();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
      >
        🎟️ 컴백 쿠폰 보내기 (이탈 단골 다시 부르기)
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-indigo-700">🎟️ 컴백 쿠폰 캠페인</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-3">닫기</button>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <label className="text-xs text-ink-3">대상 세그먼트</label>
        <div className="flex gap-1">
          {(["at_risk", "dormant", "active"] as Segment[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSegment(s)}
              className={[
                "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                segment === s ? "bg-indigo-600 text-white" : "bg-white text-ink-3 border border-line",
              ].join(" ")}
            >
              {SEG_META[s].label} {summary[s]}명
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="혜택 (예: 5,000원 이상 1,000원 할인)"
          className="mt-1 w-full rounded-md border border-line px-2.5 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <input
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          maxLength={200}
          placeholder="사용 조건 (선택, 예: 1만원 이상 구매 시)"
          className="w-full rounded-md border border-line px-2.5 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-3">유효기간</label>
          <select
            value={expiresDays}
            onChange={(e) => setExpiresDays(Number(e.target.value))}
            className="rounded-md border border-line px-2 py-1.5 text-sm"
          >
            {[7, 14, 30, 60].map((d) => (
              <option key={d} value={d}>{d}일</option>
            ))}
          </select>
        </div>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={60}
          placeholder="알림 메시지 (선택, 예: 오랜만이에요! 쿠폰 드려요)"
          className="w-full rounded-md border border-line px-2.5 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || targetCount === 0}
          className="mt-1 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "보내는 중…" : targetCount === 0 ? "대상 단골이 없어요" : `${SEG_META[segment].label} 단골 ${targetCount}명에게 보내기`}
        </button>
        <p className="text-[10px] text-ink-3">대상 단골의 쿠폰함에 바로 지급되고, 즐겨찾기 손님에겐 알림도 가요. (월 2회)</p>
      </div>
    </div>
  );
}
