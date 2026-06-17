import { NextRequest, NextResponse } from "next/server";
import { ipLimit } from "@/lib/rateLimit";
import { getCurrentUserId } from "@/lib/session";
import { recordEvents, isEventType, isEventSource, type IncomingEvent } from "@/lib/events";
import { accrueCpa } from "@/lib/ads";

/**
 * M0(수익화) — 트래픽/전환 이벤트 수집(공개, 배치).
 * sendBeacon/fetch 로 들어온 이벤트 묶음을 검증·기록한다. 비식별(sessionId) 우선, 로그인 시 userId 부가.
 * 봇/폭주 방어: IP 레이트리밋(lib/rateLimit 재사용).
 */
export const runtime = "nodejs";

const MAX_EVENTS = 100;

export async function POST(req: NextRequest) {
  // 노출 이벤트는 묶어서 보내지만, 그래도 IP 폭주는 차단(지표 오염·비용 방어)
  const limited = await ipLimit(req, "events", 120, 60_000);
  if (limited) return limited;

  let body: { sessionId?: unknown; events?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : null;
  if (!sessionId || !Array.isArray(body.events)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const events: IncomingEvent[] = [];
  for (const raw of body.events.slice(0, MAX_EVENTS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as { storeId?: unknown; type?: unknown; source?: unknown };
    if (typeof r.storeId !== "string" || !r.storeId) continue;
    if (!isEventType(r.type)) continue;
    events.push({
      storeId: r.storeId,
      type: r.type,
      source: isEventSource(r.source) ? r.source : "other",
    });
  }
  if (events.length === 0) return NextResponse.json({ ok: true, accepted: 0 });

  const userId = await getCurrentUserId(); // 비로그인이면 null (정지 계정도 null)
  try {
    const accepted = await recordEvents(events, { userId, sessionId });
    // L3: 성과형 광고 — billable 액션(갈래요·길찾기)에 활성 캠페인이 있으면 예산 차감(best-effort).
    await accrueCpa(events, { userId, sessionId }).catch(() => {});
    return NextResponse.json({ ok: true, accepted });
  } catch {
    // 수집 실패가 사용자 경험을 막지 않도록 200 으로 조용히 무시(베스트에포트)
    return NextResponse.json({ ok: false, accepted: 0 });
  }
}
