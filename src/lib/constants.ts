// 도메인 상수 (스펙에서 파생). UI/서버 공용.

/** 검색 전 기본 지도 중심 = 서울 동대문구 이문동 (스펙 2장). */
export const DEFAULT_CENTER = { lat: 37.5975, lng: 127.0596 } as const;

/** 기본 줌 레벨 (카카오맵 level: 작을수록 확대). */
export const DEFAULT_LEVEL = 4;

/** 가게 카테고리 메타. 핀 아이콘/색/라벨의 단일 출처. */
export const CATEGORY_META = {
  vegetable: { label: "야채", icon: "🥬", color: "#16a34a" },
  meat: { label: "정육", icon: "🥩", color: "#dc2626" },
  fruit: { label: "과일", icon: "🍎", color: "#ea580c" },
  laundry: { label: "세탁", icon: "🧺", color: "#0ea5e9" },
  sidedish: { label: "반찬", icon: "🥘", color: "#b45309" },
  salon: { label: "미용실", icon: "💇", color: "#db2777" },
  etc: { label: "기타", icon: "🏪", color: "#6b7280" },
} as const;

export type Category = keyof typeof CATEGORY_META;

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

/** 신고 누적 N건 시 콘텐츠 자동 숨김(soft hide) 기준 (스펙 2장, 기본 3). */
export const REPORT_HIDE_THRESHOLD = 3;
