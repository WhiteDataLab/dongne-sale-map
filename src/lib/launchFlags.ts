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
 *
 * 기본값은 **둘 다 OFF**(SiteConfig 행 없음 → off). 즉 배포 즉시 무료 모드이며,
 * 관리자가 켜야 유료/예약이 열린다.
 */
export type LaunchFlags = { monetization: boolean; reservations: boolean };

export const FLAG_KEYS = {
  monetization: "flag_monetization",
  reservations: "flag_reservations",
} as const;

/** 현재 런치 플래그. SiteConfig 미설정 키는 off(false) 로 본다(무료 모드 기본). */
export async function getLaunchFlags(): Promise<LaunchFlags> {
  const rows = await prisma.siteConfig
    .findMany({ where: { key: { in: [FLAG_KEYS.monetization, FLAG_KEYS.reservations] } } })
    .catch(() => [] as { key: string; value: string }[]);
  const v = new Map(rows.map((r) => [r.key, r.value]));
  return {
    monetization: v.get(FLAG_KEYS.monetization) === "on",
    reservations: v.get(FLAG_KEYS.reservations) === "on",
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
