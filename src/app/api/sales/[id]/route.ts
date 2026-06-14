import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import { deletePublicImages } from "@/lib/supabaseStorage";

/**
 * 세일 제보 삭제 (작성자 본인 또는 관리자).
 * 어뷰징 방어: 삭제 시 해당 제보로 적립된 PointLog 를 **회수**(삭제)한다.
 * (포인트 잔액의 출처는 PointLog 이므로 로그를 지우면 적립분이 사라짐)
 */
export const runtime = "nodejs";

const PICKUP_INFO_MAX = 200;
const STOCK_MAX = 9999;

/**
 * M7(L2) — 세일의 픽업 예약 설정 변경(reservable·stockTotal·pickupInfo).
 * 재고를 잡고 픽업을 책임지는 일이라 **소유자(사장님)·관리자만**(canManageStore).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let body: { reservable?: boolean; stockTotal?: number | null; pickupInfo?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      select: { store: { select: { ownerId: true } } },
    });
    if (!sale) return NextResponse.json({ error: "세일을 찾을 수 없어요." }, { status: 404 });
    if (!canManageStore(sale.store, user)) {
      return NextResponse.json({ error: "예약 설정은 사장님만 할 수 있어요." }, { status: 403 });
    }

    const data: { reservable?: boolean; stockTotal?: number | null; pickupInfo?: string | null } = {};

    if (typeof body.reservable === "boolean") data.reservable = body.reservable;

    if ("stockTotal" in body) {
      if (body.stockTotal == null) {
        data.stockTotal = null;
      } else {
        const n = Number(body.stockTotal);
        if (!Number.isInteger(n) || n < 1 || n > STOCK_MAX) {
          return NextResponse.json({ error: "수량은 1~9999개로 입력해 주세요." }, { status: 400 });
        }
        data.stockTotal = n;
      }
    }

    if ("pickupInfo" in body) {
      const t = body.pickupInfo?.trim();
      data.pickupInfo = t ? t.slice(0, PICKUP_INFO_MAX) : null;
    }

    // 예약을 켜려면 수량이 있어야 한다(현재 값 또는 이번 요청 값).
    if (data.reservable === true) {
      const willHaveStock =
        data.stockTotal != null ||
        (!("stockTotal" in body) &&
          (await prisma.sale.findUnique({ where: { id }, select: { stockTotal: true } }))?.stockTotal != null);
      if (!willHaveStock) {
        return NextResponse.json({ error: "예약을 받으려면 수량을 먼저 정해 주세요." }, { status: 400 });
      }
    }

    await prisma.sale.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "예약 설정에 실패했어요." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      select: { createdById: true, photoUrl: true, photoUrls: true },
    });
    if (!sale) return NextResponse.json({ error: "세일을 찾을 수 없어요." }, { status: 404 });
    if (sale.createdById !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "삭제할 권한이 없어요." }, { status: 403 });
    }

    const revoked = await prisma.$transaction(async (tx) => {
      const r = await tx.pointLog.deleteMany({ where: { refType: "sale", refId: id } });
      await tx.sale.delete({ where: { id } });
      return r.count;
    });
    await deletePublicImages([sale.photoUrl, ...(sale.photoUrls ?? [])]);

    return NextResponse.json({ ok: true, revokedPointLogs: revoked });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
  }
}
