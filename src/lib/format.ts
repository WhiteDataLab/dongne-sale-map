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
