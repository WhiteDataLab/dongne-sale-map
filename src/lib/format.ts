// UI 표시용 포맷 유틸 (친근체 톤).

/** 며칠 전인지 (0 = 오늘). */
export function daysAgo(iso: string): number {
  const t = new Date(iso).getTime();
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** 데이터 신선도 라벨 (스펙 6장: "마지막 업데이트 N일 전"). */
export function freshnessLabel(iso: string): string {
  const n = daysAgo(iso);
  return n === 0 ? "오늘 업데이트" : `${n}일 전 업데이트`;
}

export function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 세일 만료까지 남은 시간 라벨. */
export function untilLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "마감";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분 뒤 마감` : `${m}분 뒤 마감`;
}

/** 별점(1~5) → ★ 문자열. */
export function starString(rating: number): string {
  const r = Math.round(rating);
  return "★".repeat(r) + "☆".repeat(Math.max(0, 5 - r));
}

/** KST(UTC+9) 달력일 일련번호(에포크 기준 일수). 달력일 차이 계산용. */
function kstEpochDay(ms: number): number {
  return Math.floor((ms + 9 * 60 * 60 * 1000) / 86_400_000);
}

/** KST 달력일 기준 며칠 전인지 (0 = 오늘). 시각이 아니라 날짜 경계 기준. */
export function kstDaysAgo(iso: string): number {
  return Math.max(0, kstEpochDay(Date.now()) - kstEpochDay(new Date(iso).getTime()));
}

/**
 * 리뷰 작성일 라벨 — 정확한 시각 대신 KST 달력일 기준 한글 구간으로 뭉뚱그린다.
 * 오늘/어제/그제(0·1·2일 전) 이후는 주·달 근사 구간, 그 뒤로는 개월/년 단위:
 *   3~6일 → 이번주, 7~13일(저번주), 14~27일(이번달), 28~59일(저번달),
 *   60~364일 → N개월 전(2~11), 365일+ → N년 전(1·2·3…).
 */
export function reviewDateLabel(iso: string): string {
  const d = kstDaysAgo(iso);
  if (d === 0) return "오늘";
  if (d === 1) return "어제";
  if (d === 2) return "그제";
  if (d <= 6) return "이번주";
  if (d <= 13) return "저번주";
  if (d <= 27) return "이번달";
  if (d <= 59) return "저번달";
  if (d < 365) return `${Math.min(11, Math.floor(d / 30))}개월 전`;
  return `${Math.floor(d / 365)}년 전`;
}
