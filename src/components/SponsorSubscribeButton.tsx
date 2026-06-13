"use client";

import { useCallback, useState } from "react";

/**
 * M2 — 토스 빌링키 카드 등록 버튼.
 * SDK(js.tosspayments.com)를 동적 로드 → requestBillingAuth('카드') 로 카드 인증창 호출.
 * 성공 시 토스가 successUrl(/stores/[id]/sponsor/success)로 authKey·customerKey 를 붙여 리다이렉트한다.
 */
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestBillingAuth: (
        method: string,
        opts: { customerKey: string; successUrl: string; failUrl: string },
      ) => Promise<void>;
    };
  }
}

const SDK_SRC = "https://js.tosspayments.com/v1/payment";

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

export function SponsorSubscribeButton({ storeId, clientKey }: { storeId: string; clientKey: string }) {
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
      await tp.requestBillingAuth("카드", {
        customerKey,
        successUrl: `${origin}/stores/${storeId}/sponsor/success`,
        failUrl: `${origin}/stores/${storeId}/sponsor/fail`,
      });
      // 성공 시 토스가 리다이렉트하므로 이 아래는 실행되지 않음.
    } catch (e) {
      // 사용자가 인증창을 닫으면 reject 됨 — 조용히 복귀.
      const msg = e instanceof Error ? e.message : "결제 진행 중 오류가 발생했어요.";
      setError(msg);
      setPending(false);
    }
  }, [storeId, clientKey]);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-60"
      >
        {pending ? "진행 중…" : "카드 등록하고 14일 무료로 시작"}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
