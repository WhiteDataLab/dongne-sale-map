import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * 세일 제보 삭제 (작성자 본인 또는 관리자).
 * 어뷰징 방어: 삭제 시 해당 제보로 적립된 PointLog 를 **회수**(삭제)한다.
 * (포인트 잔액의 출처는 PointLog 이므로 로그를 지우면 적립분이 사라짐)
 */
export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    const sale = await prisma.sale.findUnique({ where: { id }, select: { createdById: true } });
    if (!sale) return NextResponse.json({ error: "세일을 찾을 수 없어요." }, { status: 404 });
    if (sale.createdById !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "삭제할 권한이 없어요." }, { status: 403 });
    }

    const revoked = await prisma.$transaction(async (tx) => {
      const r = await tx.pointLog.deleteMany({ where: { refType: "sale", refId: id } });
      await tx.sale.delete({ where: { id } });
      return r.count;
    });

    return NextResponse.json({ ok: true, revokedPointLogs: revoked });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
  }
}
