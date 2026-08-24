import { prisma } from "@/lib/prisma";

/**
 * 운영 오픈용 '무료 모드' 플래그 (SiteConfig 기반, 관리자가 /admin/launch 에서 토글).
 *
 * 출시 초기 전략: 3~6개월은 전면 무료로 홍보·밀도 확보에 집중하고, 사장님 유료 구독·결제와
 * 픽업 예약은 **숨겼다가 추후 오픈**한다. 코드는 삭제하지 않고 플래그로만 끈다(되돌리기 쉬움).
 *
 * - `monetization`: 사장님 유료 진입점(구독 요금제·토스 결제·CPA 광고·홍보 CTA·업셀) 노출.
 *   OFF 면 인증 사장님은 관계 기능(리뷰 답글·세일 알림·단골 식별·공식 배지)을 **무료로** 쓴다
 *   ([[storeTier]] 가 무료모드에서 인증 사장님을 lite 로 취급).
 * - `reservations`: M7 픽업 예약(예약 받기/하기) 노출.
 * - `pointshop`: 포인트샵 **교환(redeem)** 노출. OFF 면 적립은 계속하되 교환만 잠그고,
 *   `/shop` 은 "곧 교환 오픈 · 지금 모아두세요" 티저(상품 노출 + 교환 버튼 잠금)로 보인다.
 *   (포인트 적립=출석·제보·추천 은 플래그와 무관하게 항상 동작.)
 * - `classicMap`: **콜드스타트 지도 UI 롤백 스위치**(테마지도 벤치마크 개편, docs/THEME_MAP_BENCHMARK_PM_BRIEF.md).
 *   OFF(기본)=새 UI(히어로 '지금 세일중' 토글·라이브 카운터·세일 히트맵 클러스터·원탭 세일 제보 FAB),
 *   ON=이전 지도 UI(카테고리 칩 필터바·가게 등록 FAB만)로 즉시 되돌림. 데이터/API 는 공용이라 안전.
 * - `adRestraint`: **소비자 화면 광고 절제 모드**(브리프 §8-11, 야장맵 '광고 무첨가' 신뢰 전략).
 *   ON(기본)=밀도 임계 전까지 소비자 지도 표면의 광고 신호를 약화 — 마퀴 스폰서 상단 고정·'광고' 배지 제거,
 *   금색 스폰서 핀→일반 핀, 로컬 광고 스트립(L4) 비노출. 사장님 표면(/manage·구독)은 영향 없음.
 *   OFF=광고 노출 원복(밀도 임계 도달 후 관리자가 끔). ⚠️ 기본값이 ON 인 유일한 플래그(행 없음 → on).
 * - `community`: **동네 절약방(가벼운 커뮤니티) 킬스위치**(브리프 §8-7). ON(기본)=글쓰기·목록 노출,
 *   OFF=글쓰기 차단+목록 숨김(모더레이션 사고 시 즉시 잠금). 행 없음 → on.
 *
 * 기본값: monetization/reservations/pointshop/classicMap 은 OFF(행 없음 → off),
 * adRestraint/community 는 ON(행 없음 → on). 즉 배포 즉시 무료 모드 + 새 콜드스타트 UI + 광고 절제 + 절약방 오픈.
 */
export type LaunchFlags = {
  monetization: boolean;
  reservations: boolean;
  pointshop: boolean;
  classicMap: boolean;
  adRestraint: boolean;
  community: boolean;
};

export const FLAG_KEYS = {
  monetization: "flag_monetization",
  reservations: "flag_reservations",
  pointshop: "flag_pointshop",
  classicMap: "flag_classic_map",
  adRestraint: "flag_ad_restraint",
  community: "flag_community",
} as const;

/** 현재 런치 플래그. SiteConfig 미설정 키는 off(false) 로 본다(무료 모드 기본). */
export async function getLaunchFlags(): Promise<LaunchFlags> {
  const rows = await prisma.siteConfig
    .findMany({ where: { key: { in: Object.values(FLAG_KEYS) } } })
    .catch(() => [] as { key: string; value: string }[]);
  const v = new Map(rows.map((r) => [r.key, r.value]));
  return {
    monetization: v.get(FLAG_KEYS.monetization) === "on",
    reservations: v.get(FLAG_KEYS.reservations) === "on",
    pointshop: v.get(FLAG_KEYS.pointshop) === "on",
    classicMap: v.get(FLAG_KEYS.classicMap) === "on",
    // 아래 둘은 기본 ON(행 없음 → on) — 명시적으로 "off" 일 때만 꺼진다.
    adRestraint: v.get(FLAG_KEYS.adRestraint) !== "off",
    community: v.get(FLAG_KEYS.community) !== "off",
  };
}

/** 단일 플래그 on/off 저장(관리자 전용 액션에서 호출). */
export async function setLaunchFlag(key: keyof LaunchFlags, on: boolean): Promise<void> {
  const k = FLAG_KEYS[key];
  await prisma.siteConfig.upsert({
    where: { key: k },
    create: { key: k, value: on ? "on" : "off" },
    update: { value: on ? "on" : "off" },
  });
}
