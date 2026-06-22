import { prisma } from "@/lib/prisma";

/**
 * 운영/요금/광고·예약 수치를 관리자가 조정하는 통합 설정(SiteConfig 기반).
 *
 * 적립 포인트([[pointConfig]])·런치 플래그([[launchFlags]])와 같은 SiteConfig 패턴.
 * 각 도메인 lib(`sponsors`/`pro`/`alerts`/`coupons`/`reservations`/`ads`/`brands`/`constants`/`points`)에
 * 상수로 박혀 있던 값을 여기로 모아, **재배포 없이** `/admin/settings`·`/admin/pricing`·`/admin/params`에서
 * 바꿀 수 있게 한다. 각 도메인 상수는 **기본값**으로 남겨두고(헬퍼 기본 파라미터 등), 실제 판정/표시 지점은
 * `getSiteSettings()`로 라이브 값을 읽는다.
 *
 * - SiteConfig 행이 없거나 비정상 값이면 `SETTINGS_DEFAULTS` 기본값.
 * - 모든 값은 0 이상의 정수로 클램프(비율은 퍼센트 정수, 예: pickupFeePct=10 → 10%).
 */
export type SettingsGroup = "ops" | "pricing" | "params";

export type SiteSettings = {
  // ── 운영(ops) ──
  reportHideThreshold: number; // 신고 누적 자동숨김 임계
  pointExpiryYears: number; // 포인트 소멸 기간(년)
  pointHistoryYears: number; // 포인트 내역 조회 범위(년)
  productPointMaxCount: number; // 메뉴 등록 포인트 적립 상한(한 계정당 하루 N개까지만 적립)
  insightsMinStores: number; // 물가 통계 노출 최소 표본(가게 수)
  rateReview: number; // 리뷰 1분 내 작성 상한
  rateSale: number; // 세일 제보 1분 내 상한
  rateProduct: number; // 메뉴 등록 5분 내 상한
  rateStore: number; // 가게 등록 10분 내 상한
  rateReservation: number; // 예약 1분 내 상한
  rateInquiry: number; // 문의 1분 내 상한
  ratePhone: number; // SMS 발송 1분 내 상한
  // ── 사장님 요금·한도(pricing) ──
  priceSponsor: number; // 스폰서 월 구독료(원)
  priceLite: number; // 라이트 월 구독료(원)
  pricePro: number; // 프로 월 구독료(원)
  trialDays: number; // 무료체험 기간(일)
  paidPeriodDays: number; // 유료 1주기(일)
  maxBillingFailures: number; // 결제 연속 실패 자동해지 임계
  couponLimitFree: number; // 무료 가게 활성 쿠폰 한도
  couponLimitLite: number; // 라이트 활성 쿠폰 한도
  couponLimitPro: number; // 프로 활성 쿠폰 한도
  proGalleryMax: number; // 프로 사진 갤러리 최대 장수
  alertLiteMonthly: number; // 라이트 월 알림 발송 한도
  alertDaily: number; // 가게당 1일 알림 발송 상한
  couponMaxDays: number; // 쿠폰 최대 유효기간(일)
  // ── 광고·예약(params) ──
  adMinBid: number; // 성과형 광고 최소 입찰가(원)
  adMaxBid: number; // 최대 입찰가
  adMinBudget: number; // 최소 예산
  adMaxBudget: number; // 최대 예산
  brandMinCpa: number; // 브랜드 리워드 최소 CPA
  brandMaxCpa: number; // 최대 CPA
  brandMinBudget: number; // 브랜드 최소 예산
  reserveMaxQty: number; // 1회 예약 최대 수량
  pickupFeePct: number; // 픽업 플랫폼 수수료율(%)
};

export const SETTINGS_DEFAULTS: SiteSettings = {
  reportHideThreshold: 3,
  pointExpiryYears: 5,
  pointHistoryYears: 2,
  productPointMaxCount: 50,
  insightsMinStores: 3,
  rateReview: 3,
  rateSale: 3,
  rateProduct: 8,
  rateStore: 5,
  rateReservation: 5,
  rateInquiry: 3,
  ratePhone: 3,
  priceSponsor: 29_800,
  priceLite: 14_900,
  pricePro: 49_800,
  trialDays: 14,
  paidPeriodDays: 30,
  maxBillingFailures: 3,
  couponLimitFree: 20,
  couponLimitLite: 50,
  couponLimitPro: 200,
  proGalleryMax: 8,
  alertLiteMonthly: 4,
  alertDaily: 5,
  couponMaxDays: 180,
  adMinBid: 100,
  adMaxBid: 2000,
  adMinBudget: 5000,
  adMaxBudget: 1_000_000,
  brandMinCpa: 100,
  brandMaxCpa: 5000,
  brandMinBudget: 10_000,
  reserveMaxQty: 10,
  pickupFeePct: 10,
};

/** SiteConfig 키(필드 → key). 모두 `set_` 프리픽스. */
export const SETTINGS_KEYS: Record<keyof SiteSettings, string> = {
  reportHideThreshold: "set_report_hide_threshold",
  pointExpiryYears: "set_point_expiry_years",
  pointHistoryYears: "set_point_history_years",
  productPointMaxCount: "set_product_point_max_count",
  insightsMinStores: "set_insights_min_stores",
  rateReview: "set_rate_review",
  rateSale: "set_rate_sale",
  rateProduct: "set_rate_product",
  rateStore: "set_rate_store",
  rateReservation: "set_rate_reservation",
  rateInquiry: "set_rate_inquiry",
  ratePhone: "set_rate_phone",
  priceSponsor: "set_price_sponsor",
  priceLite: "set_price_lite",
  pricePro: "set_price_pro",
  trialDays: "set_trial_days",
  paidPeriodDays: "set_paid_period_days",
  maxBillingFailures: "set_max_billing_failures",
  couponLimitFree: "set_coupon_limit_free",
  couponLimitLite: "set_coupon_limit_lite",
  couponLimitPro: "set_coupon_limit_pro",
  proGalleryMax: "set_pro_gallery_max",
  alertLiteMonthly: "set_alert_lite_monthly",
  alertDaily: "set_alert_daily",
  couponMaxDays: "set_coupon_max_days",
  adMinBid: "set_ad_min_bid",
  adMaxBid: "set_ad_max_bid",
  adMinBudget: "set_ad_min_budget",
  adMaxBudget: "set_ad_max_budget",
  brandMinCpa: "set_brand_min_cpa",
  brandMaxCpa: "set_brand_max_cpa",
  brandMinBudget: "set_brand_min_budget",
  reserveMaxQty: "set_reserve_max_qty",
  pickupFeePct: "set_pickup_fee_pct",
};

export type SettingMeta = {
  key: keyof SiteSettings;
  group: SettingsGroup;
  label: string;
  desc: string;
  unit: string; // 입력 옆 단위(원/일/회/% 등)
};

/** 관리 화면 표시용 메타(그룹·라벨·단위). 순서가 곧 화면 노출 순서. */
export const SETTINGS_META: SettingMeta[] = [
  // ops
  { key: "reportHideThreshold", group: "ops", label: "신고 자동숨김 임계", desc: "콘텐츠가 이만큼 신고되면 자동으로 숨김 처리돼요.", unit: "건" },
  { key: "pointExpiryYears", group: "ops", label: "포인트 소멸 기간", desc: "적립 후 이 기간이 지난 포인트는 잔액에서 소멸돼요.", unit: "년" },
  { key: "pointHistoryYears", group: "ops", label: "포인트 내역 조회 범위", desc: "사용자가 볼 수 있는 포인트 내역 기간이에요.", unit: "년" },
  { key: "productPointMaxCount", group: "ops", label: "메뉴 등록 적립 상한(1일)", desc: "한 계정이 하루 동안 메뉴 등록으로 포인트를 받을 수 있는 최대 개수예요. 초과분은 적립되지 않아요(자정 KST 기준 초기화).", unit: "개" },
  { key: "insightsMinStores", group: "ops", label: "물가 통계 최소 표본", desc: "이 수 미만의 가게만 있는 품목은 물가 통계에서 가려요.", unit: "곳" },
  { key: "rateReview", group: "ops", label: "리뷰 작성 한도(1분)", desc: "1분 내 같은 사용자의 리뷰 작성 상한(도배 방지).", unit: "건" },
  { key: "rateSale", group: "ops", label: "세일 제보 한도(1분)", desc: "1분 내 세일 제보 상한.", unit: "건" },
  { key: "rateProduct", group: "ops", label: "메뉴 등록 한도(5분)", desc: "5분 내 메뉴 등록 상한.", unit: "건" },
  { key: "rateStore", group: "ops", label: "가게 등록 한도(10분)", desc: "10분 내 가게 등록 상한.", unit: "건" },
  { key: "rateReservation", group: "ops", label: "예약 한도(1분)", desc: "1분 내 예약 상한.", unit: "건" },
  { key: "rateInquiry", group: "ops", label: "문의 한도(1분)", desc: "1분 내 고객센터 문의 상한.", unit: "건" },
  { key: "ratePhone", group: "ops", label: "SMS 발송 한도(1분)", desc: "같은 번호 1분 내 인증문자 발송 상한.", unit: "건" },
  // pricing
  { key: "priceSponsor", group: "pricing", label: "스폰서 구독료(월)", desc: "지도 상단 마퀴 고정 + 금색 핀 묶음.", unit: "원" },
  { key: "priceLite", group: "pricing", label: "라이트 구독료(월)", desc: "세일 알림·단골·리뷰 답글·공식 배지(관계 기능).", unit: "원" },
  { key: "pricePro", group: "pricing", label: "프로 구독료(월)", desc: "라이트 전체 + 노출 부스트 + 프리미엄 혜택.", unit: "원" },
  { key: "trialDays", group: "pricing", label: "무료체험 기간", desc: "카드 등록 후 첫 결제까지 무료 기간.", unit: "일" },
  { key: "paidPeriodDays", group: "pricing", label: "유료 결제 주기", desc: "유료 1주기 노출 보장·다음 결제까지 기간.", unit: "일" },
  { key: "maxBillingFailures", group: "pricing", label: "결제 실패 해지 임계", desc: "자동결제가 이만큼 연속 실패하면 구독 해지.", unit: "회" },
  { key: "couponLimitFree", group: "pricing", label: "무료 쿠폰 한도", desc: "무료 가게의 동시 활성 쿠폰 수.", unit: "개" },
  { key: "couponLimitLite", group: "pricing", label: "라이트 쿠폰 한도", desc: "라이트 가게의 동시 활성 쿠폰 수.", unit: "개" },
  { key: "couponLimitPro", group: "pricing", label: "프로 쿠폰 한도", desc: "프로 가게의 동시 활성 쿠폰 수.", unit: "개" },
  { key: "proGalleryMax", group: "pricing", label: "프로 갤러리 최대", desc: "프로 가게 사진 갤러리 최대 장수.", unit: "장" },
  { key: "alertLiteMonthly", group: "pricing", label: "라이트 월 알림 한도", desc: "라이트 가게의 한 달 알림 발송 수(프로 무제한).", unit: "건" },
  { key: "alertDaily", group: "pricing", label: "1일 알림 상한", desc: "가게당 하루 알림 발송 상한(도배 방지).", unit: "건" },
  { key: "couponMaxDays", group: "pricing", label: "쿠폰 최대 유효기간", desc: "쿠폰 발행 시 설정 가능한 최대 유효기간.", unit: "일" },
  // params
  { key: "adMinBid", group: "params", label: "광고 최소 입찰가", desc: "성과형 광고(CPA) 1건당 최소 입찰가.", unit: "원" },
  { key: "adMaxBid", group: "params", label: "광고 최대 입찰가", desc: "성과형 광고 1건당 최대 입찰가.", unit: "원" },
  { key: "adMinBudget", group: "params", label: "광고 최소 예산", desc: "캠페인 최소 예산.", unit: "원" },
  { key: "adMaxBudget", group: "params", label: "광고 최대 예산", desc: "캠페인 최대 예산.", unit: "원" },
  { key: "brandMinCpa", group: "params", label: "브랜드 최소 CPA", desc: "브랜드 리워드 상환당 최소 단가.", unit: "원" },
  { key: "brandMaxCpa", group: "params", label: "브랜드 최대 CPA", desc: "브랜드 리워드 상환당 최대 단가.", unit: "원" },
  { key: "brandMinBudget", group: "params", label: "브랜드 최소 예산", desc: "브랜드 캠페인 최소 예산.", unit: "원" },
  { key: "reserveMaxQty", group: "params", label: "1회 예약 최대 수량", desc: "소비자가 한 번에 예약 가능한 최대 수량.", unit: "개" },
  { key: "pickupFeePct", group: "params", label: "픽업 수수료율", desc: "픽업 거래액에 대한 플랫폼 수수료율.", unit: "%" },
];

export const GROUP_LABEL: Record<SettingsGroup, string> = {
  ops: "운영 설정",
  pricing: "사장님 요금·한도",
  params: "광고·예약 파라미터",
};

/** 0 이상 정수로 정규화(비정상이면 기본값). */
function clampInt(raw: string | undefined, fallback: number): number {
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** 현재 사이트 설정 전체. 미설정 키는 기본값. */
export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await prisma.siteConfig
    .findMany({ where: { key: { in: Object.values(SETTINGS_KEYS) } } })
    .catch(() => [] as { key: string; value: string }[]);
  const v = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as SiteSettings;
  (Object.keys(SETTINGS_KEYS) as (keyof SiteSettings)[]).forEach((k) => {
    out[k] = clampInt(v.get(SETTINGS_KEYS[k]), SETTINGS_DEFAULTS[k]);
  });
  return out;
}

/** 단일 설정 저장(관리자 전용 액션에서 호출). 0 이상 정수로 저장. */
export async function setSiteSetting(key: keyof SiteSettings, value: number): Promise<void> {
  const k = SETTINGS_KEYS[key];
  const val = String(Math.max(0, Math.floor(Number.isFinite(value) ? value : SETTINGS_DEFAULTS[key])));
  await prisma.siteConfig.upsert({
    where: { key: k },
    create: { key: k, value: val },
    update: { value: val },
  });
}
