"use client";

import { useState } from "react";
import type { StoreDetailDTO } from "@/lib/types";
import type { CouponDTO } from "@/lib/coupons";

/**
 * M3 — 가게 상세 '쿠폰' 탭.
 * - 소비자: 활성 쿠폰 받기(1인 1매) → 매장에서 '사용하기'(자기처리, 스캐너 없음).
 * - 사장님/관리자(canManageStore): 쿠폰 발행 + 받음/사용 카운트 + 내리기/삭제.
 */
export function CouponSection({
  detail,
  onToast,
  onDone,
}: {
  detail: StoreDetailDTO;
  onToast: (msg: string) => void;
  onDone: () => void;
}) {
  const [composing, setComposing] = useState(false);
  const coupons = detail.coupons;
  const canManage = detail.canManageStore;

  return (
    <div className="flex flex-col gap-3">
      {canManage &&
        (composing ? (
          <CouponForm
            storeId={detail.id}
            onToast={onToast}
            onCancel={() => setComposing(false)}
            onDone={() => {
              setComposing(false);
              onDone();
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="rounded-xl border border-dashed border-rose-300 bg-rose-50/60 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            ＋ 쿠폰 발행하기
          </button>
        ))}

      {coupons.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">
          {canManage
            ? "아직 발행한 쿠폰이 없어요. 첫 쿠폰을 발행해 단골을 만들어 보세요 🎟️"
            : "아직 쿠폰이 없어요."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {coupons.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              canManage={canManage}
              onToast={onToast}
              onDone={onDone}
            />
          ))}
        </ul>
      )}

      <p className="text-[11px] leading-relaxed text-ink-3">
        · 쿠폰은 매장에서 ‘사용하기’ 화면을 사장님께 보여주고 사용해요(스캔 없이 직접 처리).
        {canManage && <br />}
        {canManage && "· 발행한 쿠폰은 마감일이 지나면 자동으로 내려가요(별도 작업 불필요)."}
      </p>
    </div>
  );
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function CouponCard({
  coupon,
  canManage,
  onToast,
  onDone,
}: {
  coupon: CouponDTO;
  canManage: boolean;
  onToast: (msg: string) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmUse, setConfirmUse] = useState(false);

  const post = async (path: string, okMsg?: string) => {
    setBusy(true);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onToast(data.error === "login_required" ? "로그인이 필요해요." : data.error || "처리에 실패했어요.");
        return;
      }
      if (okMsg) onToast(okMsg);
      onDone();
    } catch {
      onToast("네트워크 오류예요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const manage = async (method: "PATCH" | "DELETE", body?: object, okMsg?: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/coupons/${coupon.id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onToast(data.error || "처리에 실패했어요.");
        return;
      }
      if (okMsg) onToast(okMsg);
      onDone();
    } catch {
      onToast("네트워크 오류예요.");
    } finally {
      setBusy(false);
    }
  };

  const used = coupon.myClaimStatus === "used";
  const claimed = coupon.myClaimStatus === "claimed";

  return (
    <li className="overflow-hidden rounded-xl border border-rose-200">
      <div className="flex items-stretch">
        {/* 왼쪽 절취선 느낌 */}
        <div className="flex w-2 flex-col bg-rose-500" aria-hidden />
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">🎟️ {coupon.title}</p>
              {coupon.condition && (
                <p className="mt-0.5 truncate text-xs text-ink-3">{coupon.condition}</p>
              )}
              {coupon.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{coupon.description}</p>
              )}
            </div>
            {used && (
              <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-ink-3">
                사용완료
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] text-ink-3">
              ~{dateLabel(coupon.expiresAt)}까지
              {coupon.totalLimit != null && (
                <span className={coupon.soldOut ? "ml-1 font-semibold text-red-500" : "ml-1"}>
                  · {coupon.soldOut ? "소진" : `${coupon.remaining}장 남음`}
                </span>
              )}
              {canManage && (
                <span className="ml-1 text-indigo-400">
                  · 받음 {coupon.claimedCount} / 사용 {coupon.usedCount}
                </span>
              )}
            </p>

            {/* 액션 */}
            {canManage ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => manage("PATCH", { action: "end" }, "쿠폰을 내렸어요.")}
                  className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-50"
                >
                  내리기
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("쿠폰을 삭제할까요? 받은 분들의 쿠폰도 함께 사라져요.")) {
                      manage("DELETE", undefined, "삭제했어요.");
                    }
                  }}
                  className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            ) : used ? null : claimed ? (
              confirmUse ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => post(`/api/coupons/${coupon.id}/use`, "쿠폰을 사용했어요! 🎉")}
                    className="rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-600 disabled:opacity-50"
                  >
                    사장님 확인, 사용!
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmUse(false)}
                    className="rounded-lg border border-line px-2 py-1 text-[11px] text-ink-3"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmUse(true)}
                  className="shrink-0 rounded-lg bg-rose-500 px-3 py-1 text-xs font-bold text-white hover:bg-rose-600"
                >
                  사용하기
                </button>
              )
            ) : coupon.soldOut ? (
              <span className="shrink-0 rounded-lg bg-surface-2 px-3 py-1 text-xs font-medium text-ink-3">
                소진됨
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => post(`/api/coupons/${coupon.id}/claim`, "쿠폰을 받았어요! 🎟️")}
                className="shrink-0 rounded-lg border border-rose-400 bg-white px-3 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                받기
              </button>
            )}
          </div>

          {confirmUse && (
            <p className="mt-1 text-[11px] text-rose-500">
              매장에서 사장님께 이 화면을 보여준 뒤 눌러주세요. (사용 후 되돌릴 수 없어요)
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/** 사장님 쿠폰 발행 폼. 혜택 제목 + (선택)조건·설명·수량 + 마감 기간(프리셋). */
function CouponForm({
  storeId,
  onToast,
  onCancel,
  onDone,
}: {
  storeId: string;
  onToast: (msg: string) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [condition, setCondition] = useState("");
  const [description, setDescription] = useState("");
  const [limit, setLimit] = useState("");
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      onToast("혜택 제목을 입력해 주세요. (예: 5,000원 이상 1,000원 할인)");
      return;
    }
    setBusy(true);
    try {
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const totalLimit = limit.trim() ? Number(limit.trim()) : null;
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          title: title.trim(),
          condition: condition.trim() || null,
          description: description.trim() || null,
          totalLimit: totalLimit && Number.isFinite(totalLimit) ? totalLimit : null,
          expiresAt,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onToast(data.error || "발행에 실패했어요.");
        return;
      }
      onToast("쿠폰을 발행했어요! 🎟️");
      onDone();
    } catch {
      onToast("네트워크 오류예요.");
    } finally {
      setBusy(false);
    }
  };

  const DAY_OPTS = [7, 14, 30, 60];

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3">
      <p className="mb-2 text-sm font-semibold text-rose-700">🎟️ 쿠폰 발행</p>
      <div className="flex flex-col gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="혜택 (예: 5,000원 이상 1,000원 할인)"
          className="rounded-lg border border-line px-3 py-2 text-sm"
        />
        <input
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          maxLength={200}
          placeholder="사용 조건 (선택, 예: 1만원 이상 구매 시)"
          className="rounded-lg border border-line px-3 py-2 text-sm"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="안내 문구 (선택)"
          className="rounded-lg border border-line px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="발행 수량 (선택·비우면 무제한)"
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-ink-3">유효기간</p>
          <div className="flex gap-1.5">
            {DAY_OPTS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={[
                  "flex-1 rounded-lg border py-1.5 text-xs font-medium",
                  days === d
                    ? "border-rose-500 bg-rose-500 text-white"
                    : "border-line text-ink-2",
                ].join(" ")}
              >
                {d}일
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-line py-2 text-sm font-medium text-ink-3"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="flex-1 rounded-lg bg-rose-500 py-2 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {busy ? "발행 중…" : "발행하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
