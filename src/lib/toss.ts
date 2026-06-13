/**
 * M2(수익화) — 토스페이먼츠 빌링키(자동 정기결제) 서버 클라이언트.
 * 서버 전용. 시크릿(TOSS_SECRET_KEY)은 절대 클라이언트로 노출하지 않는다(`@/lib/secret` 가드 철학).
 *
 * 흐름: 클라가 SDK로 카드 인증 → authKey 수신 → 서버가 issueBillingKey 로 billingKey 발급·보관 →
 *       이후 chargeBilling 으로 빌링키에 정기 청구. 실 계약 전에는 테스트키(test_sk_*)로 동작.
 */

const TOSS_API = "https://api.tosspayments.com";
const TIMEOUT_MS = 10_000;

/** 클라이언트 키(공개). 결제 위젯/빌링 인증에 사용. */
export function tossClientKey(): string | undefined {
  return process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
}

/** 키가 모두 설정됐는지(구독 UI/크론 가드용). */
export function isTossConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY && process.env.TOSS_SECRET_KEY);
}

function authHeader(): string {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) {
    throw new Error("TOSS_SECRET_KEY 미설정 — 결제 기능을 사용할 수 없습니다(폴백 금지).");
  }
  // 토스 Basic 인증: base64(secretKey + ":")  (비밀번호 없이 콜론만)
  return "Basic " + Buffer.from(`${secret}:`).toString("base64");
}

async function tossFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${TOSS_API}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // 토스 에러: { code, message }
    const msg = typeof data.message === "string" ? data.message : `토스 오류 (HTTP ${res.status})`;
    const code = typeof data.code === "string" ? data.code : "UNKNOWN";
    throw new TossError(code, msg);
  }
  return data as T;
}

/** 토스 API 에러(코드+메시지). 결제 실패 사유 로깅에 사용. */
export class TossError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "TossError";
  }
}

export type BillingKeyResult = {
  billingKey: string;
  customerKey: string;
  card?: { company?: string; number?: string };
};

/** 카드 인증(authKey) → 빌링키 발급. 카드 등록 성공 직후 1회 호출. */
export async function issueBillingKey(authKey: string, customerKey: string): Promise<BillingKeyResult> {
  return tossFetch<BillingKeyResult>("/v1/billing/authorizations/issue", { authKey, customerKey });
}

export type ChargeResult = {
  paymentKey: string;
  orderId: string;
  status: string; // "DONE" 등
  method?: string;
  totalAmount?: number;
};

/** 빌링키로 정기 청구. orderId 는 멱등키(중복 청구 방지)로 호출자가 유니크하게 생성. */
export async function chargeBilling(
  billingKey: string,
  opts: { customerKey: string; amount: number; orderId: string; orderName: string },
): Promise<ChargeResult> {
  return tossFetch<ChargeResult>(`/v1/billing/${encodeURIComponent(billingKey)}`, {
    customerKey: opts.customerKey,
    amount: opts.amount,
    orderId: opts.orderId,
    orderName: opts.orderName,
  });
}
