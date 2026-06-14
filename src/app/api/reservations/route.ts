import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import {
  RESERVE_MAX_QTY,
  computePickupFee,
  makePickupCode,
  activeReservationFilter,
} from "@/lib/reservations";

/**
 * M7(L2) — 떨이 픽업 예약 생성(선점).
 * v1=현장결제 — 결제 없이 선점만(매장에서 지불). 활성 예약(reserved/picked_up)이 재고를 점유.
 * 가드: 로그인·예약가능 세일·미만료·재고·동일세일 1인 1활성예약·레이트리밋.
 */
export const runtime = "nodejs";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let body: { saleId?: string; qty?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const saleId = body.saleId;
  const qty = Number(body.qty ?? 1);
  if (!saleId) return NextResponse.json({ error: "세일을 찾을 수 없어요." }, { status: 400 });
  if (!Number.isInteger(qty) || qty < 1 || qty > RESERVE_MAX_QTY) {
    return NextResponse.json({ error: `수량은 1~${RESERVE_MAX_QTY}개로 선택해 주세요.` }, { status: 400 });
  }

  try {
    // 레이트리밋: 단시간 연속 예약 폭주 차단.
    const recent = await prisma.reservation.count({
      where: { userId, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
    });
    if (recent >= RATE_MAX) {
      return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        select: {
          id: true,
          storeId: true,
          salePrice: true,
          status: true,
          expiresAt: true,
          reservable: true,
          stockTotal: true,
          store: { select: { status: true } },
        },
      });
      if (!sale || sale.store.status !== "active") {
        return { error: "가게를 찾을 수 없어요.", status: 404 as const };
      }
      if (!sale.reservable || sale.stockTotal == null) {
        return { error: "예약을 받지 않는 세일이에요.", status: 400 as const };
      }
      if (sale.status !== "active" || sale.expiresAt <= now) {
        return { error: "마감된 세일이에요.", status: 410 as const };
      }

      // 동일 세일 1인 1활성 예약(중복 선점 방지).
      const existing = await tx.reservation.findFirst({
        where: { saleId, userId, status: "reserved" },
        select: { id: true },
      });
      if (existing) {
        return { error: "이미 예약한 세일이에요.", status: 409 as const };
      }

      // 재고 확인(활성 예약 점유 수량 재집계 → 초과 차단).
      const agg = await tx.reservation.aggregate({
        where: { saleId, ...activeReservationFilter() },
        _sum: { qty: true },
      });
      const reserved = agg._sum.qty ?? 0;
      const remaining = sale.stockTotal - reserved;
      if (qty > remaining) {
        return { error: remaining <= 0 ? "예약이 마감됐어요." : `남은 수량은 ${remaining}개예요.`, status: 409 as const };
      }

      const amountKrw = sale.salePrice * qty;
      const created = await tx.reservation.create({
        data: {
          saleId: sale.id,
          storeId: sale.storeId,
          userId,
          qty,
          unitPriceKrw: sale.salePrice,
          amountKrw,
          feeKrw: computePickupFee(amountKrw),
          pickupCode: makePickupCode(),
        },
        select: { id: true, pickupCode: true },
      });
      return { ok: true as const, id: created.id, pickupCode: created.pickupCode };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, id: result.id, pickupCode: result.pickupCode });
  } catch {
    return NextResponse.json({ error: "예약에 실패했어요." }, { status: 500 });
  }
}
