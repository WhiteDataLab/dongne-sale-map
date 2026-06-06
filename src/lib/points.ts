// 포인트 정책 (스펙 파생 + 사용자 요청).
// - 잔액의 단일 출처는 PointLog 합계 (User.points 는 표시 캐시).
// - 조회(히스토리)는 최근 2년만 노출.
// - 적립 후 5년 경과분은 소멸(잔액에서 제외).

export const POINT_HISTORY_YEARS = 2; // 사용자가 볼 수 있는 내역 범위
export const POINT_EXPIRY_YEARS = 5; // 이 기간 지난 적립분은 소멸

/** n년 전 시각. */
export function yearsAgo(n: number, from = new Date()): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() - n);
  return d;
}

/** 포인트 잔액 = PointLog 합계(소멸 기간 이내). (서버 전용) */
export async function getPointBalance(userId: string): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const agg = await prisma.pointLog.aggregate({
    _sum: { amount: true },
    where: { userId, createdAt: { gte: yearsAgo(POINT_EXPIRY_YEARS) } },
  });
  // 표시/판정용 잔액은 절대 음수가 되지 않게 0으로 클램프(소비는 잔액 검증으로 차단됨).
  return Math.max(0, agg._sum.amount ?? 0);
}
