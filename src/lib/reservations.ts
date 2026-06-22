import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type Category } from "@/lib/constants";

/**
 * M7(L2) — 떨이 픽업 예약 헬퍼.
 * 마감임박 세일(`Sale.reservable`)을 소비자가 앱에서 선점(예약)하고 매장에서 픽업한다.
 * v1=현장결제(매장 지불) — 앱은 선점/픽업확인/노쇼만 처리(쿠폰 use 자기처리와 동일한 신뢰 모델).
 * 선결제(토스 일반결제)·자동 정산분배는 Phase 2.
 *
 * '활성 예약'(재고를 점유하는) = status ∈ {reserved, picked_up}. canceled/no_show 는 재고 환원.
 * 픽업 마감은 세일의 `expiresAt` 기준(Sale 만료 패턴 그대로) — 별도 크론 불필요.
 */

/** 1회 예약 최대 수량(앱 레벨 가드). */
export const RESERVE_MAX_QTY = 10;
/** 플랫폼 수수료율(take). 픽업 완료 시 확정되는 미수금(실 청구는 Phase 2 수동/스캐폴드). */
export const PICKUP_FEE_RATE = 0.1;

/** 거래액(amount)에 대한 플랫폼 수수료(원). 10원 단위 반올림. feePct 는 퍼센트(기본 10%). */
export function computePickupFee(amount: number, feePct: number = PICKUP_FEE_RATE * 100): number {
  return Math.round((amount * (feePct / 100)) / 10) * 10;
}

/** 매장 확인용 4자리 픽업 코드. */
export function makePickupCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** 재고를 점유하는(활성) 예약 상태. */
export const ACTIVE_RESERVATION_STATUSES = ["reserved", "picked_up"] as const;

/** 한 세일의 활성 예약(=점유 수량)만 거르는 Prisma 필터. */
export function activeReservationFilter(): Prisma.ReservationWhereInput {
  return { status: { in: ["reserved", "picked_up"] } };
}

/** 세일별 활성 예약 점유 수량(qty 합). 재고 = stockTotal − 점유. */
export async function reservedQtyForSale(saleId: string): Promise<number> {
  const agg = await prisma.reservation.aggregate({
    where: { saleId, ...activeReservationFilter() },
    _sum: { qty: true },
  });
  return agg._sum.qty ?? 0;
}

/** 여러 세일의 활성 예약 점유 수량 맵(상세 DTO 배선용, N+1 방지). */
export async function reservedQtyMap(saleIds: string[]): Promise<Map<string, number>> {
  if (saleIds.length === 0) return new Map();
  const groups = await prisma.reservation.groupBy({
    by: ["saleId"],
    where: { saleId: { in: saleIds }, ...activeReservationFilter() },
    _sum: { qty: true },
  });
  return new Map(groups.map((g) => [g.saleId, g._sum.qty ?? 0]));
}

/** 가게 상세 세일 항목에 얹는 예약 요약(소비자 노출용). */
export type SaleReservationInfo = {
  reservable: boolean;
  stockTotal: number | null;
  remaining: number | null; // 남은 수량(reservable 일 때만)
  soldOut: boolean;
  pickupInfo: string | null;
  myActiveReservationId: string | null; // 로그인 소비자의 진행중(reserved) 예약
};

/** 사장님/소비자 공용 예약 DTO. */
export type ReservationDTO = {
  id: string;
  saleId: string;
  storeId: string;
  storeName: string;
  category: Category;
  saleTitle: string;
  photoUrl: string | null;
  qty: number;
  unitPriceKrw: number;
  amountKrw: number;
  feeKrw: number;
  status: "reserved" | "picked_up" | "canceled" | "no_show";
  pickupCode: string;
  pickupInfo: string | null;
  expiresAt: string; // 픽업 마감(세일 만료)
  createdAt: string;
  pickedUpAt: string | null;
  canceledAt: string | null;
};

const RESERVATION_SELECT = {
  id: true,
  saleId: true,
  storeId: true,
  qty: true,
  unitPriceKrw: true,
  amountKrw: true,
  feeKrw: true,
  status: true,
  pickupCode: true,
  createdAt: true,
  pickedUpAt: true,
  canceledAt: true,
  store: { select: { name: true, category: true } },
  sale: { select: { title: true, photoUrl: true, expiresAt: true, pickupInfo: true } },
} satisfies Prisma.ReservationSelect;

type ReservationRow = Prisma.ReservationGetPayload<{ select: typeof RESERVATION_SELECT }>;

function toDTO(r: ReservationRow): ReservationDTO {
  return {
    id: r.id,
    saleId: r.saleId,
    storeId: r.storeId,
    storeName: r.store.name,
    category: r.store.category as Category,
    saleTitle: r.sale.title,
    photoUrl: r.sale.photoUrl,
    qty: r.qty,
    unitPriceKrw: r.unitPriceKrw,
    amountKrw: r.amountKrw,
    feeKrw: r.feeKrw,
    status: r.status,
    pickupCode: r.pickupCode,
    pickupInfo: r.sale.pickupInfo,
    expiresAt: r.sale.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    pickedUpAt: r.pickedUpAt?.toISOString() ?? null,
    canceledAt: r.canceledAt?.toISOString() ?? null,
  };
}

/** 내 예약함(`/reservations`): 진행중 먼저, 그다음 최신순. */
export async function getMyReservations(userId: string): Promise<ReservationDTO[]> {
  const rows = await prisma.reservation.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: RESERVATION_SELECT,
  });
  return rows.map(toDTO);
}

/** 사장님 대시보드: 우리 가게로 들어온 예약(진행중 먼저). */
export async function getStoreReservations(storeId: string): Promise<ReservationDTO[]> {
  const rows = await prisma.reservation.findMany({
    where: { storeId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: RESERVATION_SELECT,
  });
  return rows.map(toDTO);
}
