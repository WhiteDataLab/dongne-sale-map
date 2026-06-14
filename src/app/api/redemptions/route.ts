import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getGiftItem } from "@/lib/gifts";
import { POINT_EXPIRY_YEARS, yearsAgo } from "@/lib/points";

/**
 * 포인트 → 기프티콘 교환 신청.
 * - 연락처(contactPhone) 필수(없으면 409 needContact)
 * - 잔액 >= 필요 포인트 (트랜잭션 내 재확인으로 이중 차감 방지)
 * - 차감은 음수 PointLog, 주문은 Redemption(requested). 발송은 관리자 수동.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let body: { itemId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const item = await getGiftItem(String(body.itemId ?? ""));
  if (!item || !item.active) return NextResponse.json({ error: "상품을 찾을 수 없어요." }, { status: 404 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { contactPhone: true },
    });
    if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
    if (!user.contactPhone) {
      return NextResponse.json(
        { error: "기프티콘을 받을 연락처를 먼저 등록해 주세요.", needContact: true },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const agg = await tx.pointLog.aggregate({
          _sum: { amount: true },
          where: { userId, createdAt: { gte: yearsAgo(POINT_EXPIRY_YEARS) } },
        });
        const balance = agg._sum.amount ?? 0;
        // 잔액 부족 시 교환 불가 — 차감 후 잔액이 음수가 되는 일을 원천 차단.
        if (balance < item.points) {
          return { ok: false as const, balance };
        }
        const redemption = await tx.redemption.create({
          data: {
            userId,
            itemId: item.id,
            itemName: `${item.brand} ${item.name}`,
            points: item.points,
            contact: user.contactPhone!,
            // M5: 정산용 스냅샷(교환 시점의 원가·제휴사).
            costKrw: item.costKrw,
            partner: item.partner,
          },
        });
        await tx.pointLog.create({
          data: {
            userId,
            amount: -item.points,
            reason: `기프티콘 교환: ${item.brand} ${item.name}`,
            status: "granted",
            refType: "redemption",
            refId: redemption.id,
          },
        });
        // 안전장치: 차감 직후 잔액 재계산 → 음수면 롤백(트랜잭션 throw)
        const after = await tx.pointLog.aggregate({
          _sum: { amount: true },
          where: { userId, createdAt: { gte: yearsAgo(POINT_EXPIRY_YEARS) } },
        });
        if ((after._sum.amount ?? 0) < 0) {
          throw new Error("negative_balance_guard");
        }
        return { ok: true as const, balance: after._sum.amount ?? 0, redemptionId: redemption.id };
      },
      // 동시 교환에 따른 이중 차감 방지(직렬화)
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: `포인트가 부족해요. (보유 ${result.balance}P / 필요 ${item.points}P)`, balance: result.balance },
        { status: 409 },
      );
    }
    return NextResponse.json({
      ok: true,
      balance: result.balance,
      message: "교환 완료! 등록한 연락처로 기프티콘을 보내드려요.",
    });
  } catch {
    // 직렬화 충돌·안전가드 롤백 등 → 차감 없이 안전하게 실패. 재시도 안내.
    return NextResponse.json(
      { error: "잠시 후 다시 시도해 주세요. (포인트는 차감되지 않았어요)" },
      { status: 409 },
    );
  }
}
