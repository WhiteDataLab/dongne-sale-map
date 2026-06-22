import { prisma } from "@/lib/prisma";

/**
 * 적립 포인트 수치(관리자가 /admin/points 에서 자유롭게 조정).
 *
 * 기존엔 각 API 라우트에 상수로 하드코딩돼 있던 적립액(리뷰·제보·메뉴·추천·출석)을
 * SiteConfig 기반으로 옮겨, **재배포 없이** 관리자가 값을 바꿀 수 있게 한다.
 * (런치 플래그 [[launchFlags]] 와 동일한 SiteConfig 패턴.)
 *
 * - SiteConfig 행이 없거나 값이 비정상이면 `POINT_DEFAULTS` 기본값을 쓴다.
 * - 모든 값은 0 이상의 정수(원=포인트)로 클램프한다.
 */
export type PointConfig = {
  review: number; // 리뷰 작성(첫 리뷰 또는 사진/영수증 인증 리뷰)
  saleReport: number; // 세일/행사 제보
  product: number; // 메뉴(상품) 등록
  referral: number; // 추천인 보상(추천인·친구 각각)
  checkinDaily: number; // 출석 매일
  checkinWeekly: number; // 출석 연속 7일 보너스
  checkinMonthly: number; // 출석 연속 30일 보너스
};

export const POINT_DEFAULTS: PointConfig = {
  review: 10,
  saleReport: 10,
  product: 5,
  referral: 50,
  checkinDaily: 10,
  checkinWeekly: 20,
  checkinMonthly: 50,
};

export const POINT_CONFIG_KEYS: Record<keyof PointConfig, string> = {
  review: "point_review",
  saleReport: "point_sale_report",
  product: "point_product",
  referral: "point_referral",
  checkinDaily: "point_checkin_daily",
  checkinWeekly: "point_checkin_weekly",
  checkinMonthly: "point_checkin_monthly",
};

/** 관리 화면 표시용 메타(라벨·설명). 순서가 곧 화면 노출 순서. */
export const POINT_CONFIG_META: { key: keyof PointConfig; label: string; desc: string }[] = [
  { key: "review", label: "리뷰 작성", desc: "첫 리뷰 또는 사진·영수증 인증 리뷰 작성 시 적립" },
  { key: "saleReport", label: "세일 · 행사 제보", desc: "세일/행사를 제보하면 즉시 적립" },
  { key: "product", label: "메뉴 등록", desc: "가게 메뉴(상품)를 등록하면 적립" },
  { key: "referral", label: "친구 초대", desc: "추천 코드로 친구가 가입하면 추천인·친구 각각 적립" },
  { key: "checkinDaily", label: "출석 (매일)", desc: "하루 1회 출석 시 적립" },
  { key: "checkinWeekly", label: "출석 보너스 (연속 7일)", desc: "연속 7일마다 추가 적립" },
  { key: "checkinMonthly", label: "출석 보너스 (연속 30일)", desc: "연속 30일마다 추가 적립" },
];

/** 0 이상 정수로 정규화(비정상이면 기본값). */
function clamp(raw: string | undefined, fallback: number): number {
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** 현재 적립 포인트 설정. SiteConfig 미설정 키는 기본값으로 채운다. */
export async function getPointConfig(): Promise<PointConfig> {
  const rows = await prisma.siteConfig
    .findMany({ where: { key: { in: Object.values(POINT_CONFIG_KEYS) } } })
    .catch(() => [] as { key: string; value: string }[]);
  const v = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as PointConfig;
  (Object.keys(POINT_CONFIG_KEYS) as (keyof PointConfig)[]).forEach((k) => {
    out[k] = clamp(v.get(POINT_CONFIG_KEYS[k]), POINT_DEFAULTS[k]);
  });
  return out;
}

/** 단일 적립 수치 저장(관리자 전용 액션에서 호출). 0 이상 정수로 저장. */
export async function setPointConfig(key: keyof PointConfig, value: number): Promise<void> {
  const k = POINT_CONFIG_KEYS[key];
  const val = String(Math.max(0, Math.floor(Number.isFinite(value) ? value : POINT_DEFAULTS[key])));
  await prisma.siteConfig.upsert({
    where: { key: k },
    create: { key: k, value: val },
    update: { value: val },
  });
}
