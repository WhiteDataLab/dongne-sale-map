/**
 * M0(수익화) — 클라이언트 이벤트 트래킹 (베스트에포트, 비차단).
 * sendBeacon 우선(언로드 안전) → keepalive fetch 폴백. 실패는 조용히 무시(UX 비방해).
 * 비식별 우선: 랜덤 sessionId 만 동반(로그인 식별은 서버가 쿠키로 부가).
 */

const SID_KEY = "dsm_sid";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let s = localStorage.getItem(SID_KEY);
    if (!s) {
      s =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SID_KEY, s);
    }
    return s;
  } catch {
    return "anon";
  }
}

export type TrackEvent = { storeId: string; type: string; source?: string };

/** 이벤트 전송(단건 또는 묶음). */
export function track(events: TrackEvent | TrackEvent[]): void {
  if (typeof window === "undefined") return;
  const list = Array.isArray(events) ? events : [events];
  if (list.length === 0) return;
  const payload = JSON.stringify({ sessionId: getSessionId(), events: list });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch {
    // sendBeacon 실패 → fetch 폴백
  }
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // 무시
  }
}

// 노출(impression) 중복 억제 — 같은 세션에서 같은 가게 노출은 1회만 전송(쓰기량·지표오염 관리).
const seenImpressions = new Set<string>();

/** 현재 화면에 노출된 가게들의 impression 을 (중복 제거 후) 전송. */
export function trackImpressions(storeIds: string[], source = "pin"): void {
  const fresh = storeIds.filter((id) => id && !seenImpressions.has(id));
  if (fresh.length === 0) return;
  fresh.forEach((id) => seenImpressions.add(id));
  track(fresh.map((id) => ({ storeId: id, type: "impression", source })));
}
