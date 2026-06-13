import { NextRequest, NextResponse } from "next/server";

/**
 * 레이트리밋 (고정 윈도, fixed-window).
 *
 * 2단 구성:
 *  1) **Upstash Redis REST** 가 설정되어 있으면(UPSTASH_REDIS_REST_URL/TOKEN) 그걸 써서
 *     **전역(모든 서버리스 인스턴스 공유)** 카운트로 제한한다. (의존성 없이 fetch 로 직접 호출)
 *  2) 미설정이거나 Redis 호출 실패 시 **인메모리(인스턴스별)** 로 폴백한다.
 *
 * → 운영에서 Upstash 환경변수만 넣으면 자동으로 분산 제한이 켜지고,
 *   없으면 최소한 인스턴스별 폭주는 막는 1차 방어선으로 동작한다(가용성 유지).
 */
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
const MAX_KEYS = 50_000; // 메모리 폭증 방지 상한

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function upstashConfigured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

/** 인메모리 고정 윈도 카운터. */
function memLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    if (store.size > MAX_KEYS) {
      for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
    }
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= max) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

/**
 * Upstash Redis 고정 윈도: 한 번의 pipeline 왕복으로 INCR + (최초만)EXPIRE.
 * EXPIRE ... NX 로 최초 설정자만 TTL 을 걸어 키가 영구 잔존하는 일을 막는다.
 * 실패하면 null 반환 → 호출부가 인메모리로 폴백.
 */
async function redisLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfter: number } | null> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `rl:${key}`;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(windowSec), "NX"],
      ]),
      // 레이트리밋이 외부 호출 때문에 느려지지 않게 짧은 타임아웃
      signal: AbortSignal.timeout(1000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = data?.[0]?.result;
    if (typeof count !== "number") return null;
    if (count > max) return { ok: false, retryAfter: windowSec };
    return { ok: true, retryAfter: 0 };
  } catch {
    return null; // 네트워크/타임아웃 → 폴백
  }
}

/** key 에 대해 windowMs 동안 max 회 허용. 초과 시 ok=false. (분산 우선, 실패 시 인메모리) */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  if (upstashConfigured()) {
    const r = await redisLimit(key, max, windowMs);
    if (r) return r;
    // Redis 실패 시 인메모리로 폴백(보호 유지)
  }
  return memLimit(key, max, windowMs);
}

/** 프록시 뒤(Vercel)에서의 클라이언트 IP 추정. 없으면 "unknown". */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * IP 기준 레이트리밋을 적용하고, 초과 시 429 응답을 반환(통과면 null).
 * 사용: `const limited = await ipLimit(req, "geocode", 30, 60_000); if (limited) return limited;`
 */
export async function ipLimit(
  req: NextRequest,
  bucket: string,
  max: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const { ok, retryAfter } = await rateLimit(`${bucket}:${clientIp(req)}`, max, windowMs);
  if (ok) return null;
  return NextResponse.json(
    { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
