"use client";

import { useCallback, useState } from "react";

/**
 * M2 — 토스 빌링키 카드 등록 버튼 (v2 SDK).
 * SDK(js.tosspayments.com/v2/standard)를 동적 로드 →
 * tossPayments.payment({customerKey}).requestBillingAuth({method:"CARD", ...}) 로 카드 인증창 호출.
 * 성공 시 토스가 successUrl(/stores/[id]/sponsor/success)로 authKey·customerKey 를 붙여 리다이렉트한다.
 * (v1 방식 requestBillingAuth("카드", …)는 2024-06-01 키에서 REQUEST_ERROR → v2 방식으로 변경.)
 */
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      payment: (opts: { customerKey: string }) => {
        requestBillingAuth: (opts: {
          method: string;
          successUrl: string;
          failUrl: string;
        }) => Promise<void>;
      };
    };
  }
}

const SDK_SRC = "https://js.tosspayments.com/v2/standard";

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("SDK 로드 실패")));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("SDK 로드 실패"));
    document.head.appendChild(s);
  });
}

export function SponsorSubscribeButton({
  storeId,
  clientKey,
  plan = "sponsor",
  label = "카드 등록하고 14일 무료로 시작",
  tone = "neutral",
}: {
  storeId: string;
  clientKey: string;
  plan?: "sponsor" | "lite" | "pro";
  label?: string;
  /** primary=블루(추천) · neutral=보조면 · dark=다크 카드 위 흰 버튼 */
  tone?: "primary" | "neutral" | "dark";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      await loadSdk();
      if (!window.TossPayments) throw new Error("결제 모듈을 불러오지 못했어요.");
      const customerKey = `dsm_${crypto.randomUUID()}`;
      const origin = window.location.origin;
      const tp = window.TossPayments(clientKey);
      const payment = tp.payment({ customerKey });
      // 토스는 successUrl 의 기존 쿼리를 보존하므로 ?plan= 으로 선택 플랜을 콜백까지 전달.
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${origin}/stores/${storeId}/sponsor/success?plan=${plan}`,
        failUrl: `${origin}/stores/${storeId}/sponsor/fail`,
      });
      // 성공 시 토스가 리다이렉트하므로 이 아래는 실행되지 않음.
    } catch (e) {
      // 토스 SDK 는 { code, message } 로 거절한다(Error 인스턴스가 아닐 수 있음).
      const err = e as { code?: string; message?: string };
      const code = err?.code;
      // 사용자가 인증창을 닫음 → 에러 아님, 조용히 복귀.
      if (code === "USER_CANCEL" || code === "PAY_PROCESS_CANCELED") {
        setPending(false);
        return;
      }
      console.error("[toss requestBillingAuth]", e);
      const msg = err?.message || "결제 진행 중 오류가 발생했어요.";
      setError(code ? `${msg} (${code})` : msg);
      setPending(false);
    }
  }, [storeId, clientKey, plan]);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className={[
          "w-full rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition-colors disabled:opacity-60",
          tone === "primary"
            ? "bg-brand text-white hover:bg-brand-ink"
            : tone === "dark"
              ? "bg-white text-ink hover:bg-surface-2"
              : "border border-line bg-surface-2 text-ink hover:bg-white",
        ].join(" ")}
      >
        {pending ? "진행 중…" : label}
      </button>
      {error && <p className="mt-2 text-center text-xs text-deal-ink">{error}</p>}
    </div>
  );
}
