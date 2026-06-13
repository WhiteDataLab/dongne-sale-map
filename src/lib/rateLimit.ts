import { NextRequest, NextResponse } from "next/server";

/**
 * 경량 고정 윈도(fixed-window) 레이트리밋 (의존성 없음, 인메모리).
 *
 * 목적: 인증이 필요 없는 비용·트래픽 남용 경로(지오코딩/장소검색 프록시, 업로드 등)에서
 *       단일 IP/키의 폭주를 막는다. 외부 API(카카오) 쿼터 고갈·스토리지 비용 폭증 방어.
 *
 * 한계(운영 주의): 서버리스(Vercel)는 인스턴스마다 메모리가 분리되므로 전역 카운트가 아니다.
 *   분산 환경의 정밀 제한이 필요하면 Upstash Redis 등 durable store 로 교체할 것.
 *   그래도 "한 인스턴스에서의 폭주"는 막아 주므로 1차 방어선으로 충분하다.
 */
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
const MAX_KEYS = 50_000; // 메모리 폭증 방지 상한

/** key 에 대해 windowMs 동안 max 회 허용. 초과 시 ok=false. */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    // 만료된 버킷 정리(맵이 너무 커지면 전체 스윕)
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

/** 프록시 뒤(Vercel)에서의 클라이언트 IP 추정. 없으면 "unknown". */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * IP 기준 레이트리밋을 적용하고, 초과 시 429 응답을 반환(통과면 null).
 * 사용: `const limited = ipLimit(req, "geocode", 30, 60_000); if (limited) return limited;`
 */
export function ipLimit(
  req: NextRequest,
  bucket: string,
  max: number,
  windowMs: number,
): NextResponse | null {
  const { ok, retryAfter } = rateLimit(`${bucket}:${clientIp(req)}`, max, windowMs);
  if (ok) return null;
  return NextResponse.json(
    { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
