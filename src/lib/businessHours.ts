// 영업시간(hoursJson) 자동판정 — KST(Asia/Seoul) 기준, 요일+시간 (스펙 Phase 2).
// hoursJson 형식: 요일 키별 { open, close } 또는 null(휴무). 자정 넘김(close<open) 지원.

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

/** null = 휴무. open/close 는 "HH:mm" (24h). close<open 이면 자정 넘김. */
export type DayHours = { open: string; close: string } | null;

export type StoreHours = Partial<Record<DayKey, DayHours>>;

export const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DAY_LABELS: Record<DayKey, string> = {
  sun: "일",
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
};

const WEEKDAY_TO_KEY: Record<string, DayKey> = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 현재 KST 의 요일/분(0~1439). */
export function getKstNow(date = new Date()): { dayKey: DayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  let hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  if (hour === 24) hour = 0; // en-US hour12:false 가 24 를 줄 수 있음
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return { dayKey: WEEKDAY_TO_KEY[weekday], minutes: hour * 60 + minute };
}

/**
 * 지금 영업중인가? true=영업중 / false=영업종료 / null=영업시간 정보 없음.
 * 전날 영업이 자정을 넘겨 이어지는 경우도 판정한다.
 */
export function isOpenNow(
  hours: StoreHours | null | undefined,
  date = new Date(),
): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null;

  const { dayKey, minutes } = getKstNow(date);
  const idx = DAY_KEYS.indexOf(dayKey);
  const prevKey = DAY_KEYS[(idx + 6) % 7];

  // 1) 전날 영업이 자정을 넘겨 오늘 새벽까지 이어지는 경우
  const prev = hours[prevKey];
  if (prev) {
    const o = toMinutes(prev.open);
    const c = toMinutes(prev.close);
    if (c < o && minutes < c) return true;
  }

  // 2) 오늘 영업시간
  const today = hours[dayKey];
  if (!today) return false; // 휴무
  const open = toMinutes(today.open);
  const close = toMinutes(today.close);
  if (close <= open) {
    // 자정 넘김 → open~자정까지 영업 (자정 이후는 위 prev 로직이 처리)
    return minutes >= open;
  }
  return minutes >= open && minutes < close;
}

/** 06:00 KST — 마감 후 이 시각까지는 '영업종료', 이후 당일 오픈 전까지는 '영업준비중'. */
const PREPARING_FROM_MIN = 6 * 60;

/** 영업 상태 3-state: 영업중 / 영업준비중(오늘 오픈 전 대기) / 영업종료(마감·휴무). */
export type OpenStatus = "open" | "preparing" | "closed";

/**
 * 표시용 영업 상태. open=영업중, preparing=영업준비중, closed=영업종료, null=정보없음.
 * 닫혀 있을 때 새벽 6시 이후 ~ 오늘 영업 시작 전이면 '영업준비중'(곧 엶), 그 외(마감~새벽6시·휴무)는 '영업종료'.
 */
export function openStatusNow(
  hours: StoreHours | null | undefined,
  date = new Date(),
): OpenStatus | null {
  const open = isOpenNow(hours, date);
  if (open === null) return null;
  if (open) return "open";
  // 닫힘 → 오늘 오픈 전(06:00~오픈) 구간이면 '준비중', 아니면 '종료'
  const { dayKey, minutes } = getKstNow(date);
  const today = hours?.[dayKey];
  if (today) {
    const openMin = toMinutes(today.open);
    if (minutes >= PREPARING_FROM_MIN && minutes < openMin) return "preparing";
  }
  return "closed";
}

/** KST(UTC+9) 기준 오늘 자정을 실제 UTC Date 로. (createdAt 은 UTC 저장) */
export function kstTodayStart(): Date {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const startKstAsUtc = Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate());
  return new Date(startKstAsUtc - 9 * 60 * 60 * 1000);
}

/** Prisma Json(unknown) → StoreHours 안전 변환. */
export function asStoreHours(value: unknown): StoreHours | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as StoreHours;
}

export function formatDayHours(h: DayHours): string {
  return h ? `${h.open} – ${h.close}` : "휴무";
}

/**
 * 지금부터 오늘 영업 마감까지 남은 분(分). 세일 "마감까지" 만료시간 계산용.
 * 휴무/정보없음/이미 마감 → null.
 */
export function minutesUntilClose(
  hours: StoreHours | null | undefined,
  now = new Date(),
): number | null {
  if (!hours) return null;
  const { dayKey, minutes } = getKstNow(now);
  const today = hours[dayKey];
  if (!today) return null;
  const open = toMinutes(today.open);
  let close = toMinutes(today.close);
  if (close <= open) close += 24 * 60; // 자정 넘김
  const diff = close - minutes;
  return diff > 0 ? diff : null;
}
