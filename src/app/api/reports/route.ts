import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { REPORT_HIDE_THRESHOLD } from "@/lib/constants";

/**
 * 신고/정정 접수 (스펙 Phase 4).
 * Report 생성 후, 같은 대상에 open 신고가 임계치(기본 3) 이상이면 콘텐츠 자동 숨김(soft hide).
 * 사후 검토는 관리 화면(/admin/reports)에서.
 */
export const runtime = "nodejs";

const TARGET_TYPES = ["store", "sale", "review"] as const;
type TargetType = (typeof TARGET_TYPES)[number];

type Body = { targetType?: string; targetId?: string; reason?: string };

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const { targetType, targetId, reason } = body;
  if (
    !targetId ||
    !reason?.trim() ||
    !targetType ||
    !TARGET_TYPES.includes(targetType as TargetType)
  ) {
    return NextResponse.json({ error: "신고 대상과 사유가 필요해요." }, { status: 400 });
  }

  const type = targetType as TargetType;
  try {
    const report = await prisma.report.create({
      data: { targetType: type, targetId, reason: reason.trim(), reporterId: userId },
    });

    // 신고 누적 N건 → 콘텐츠 자동 숨김(soft hide), 사후 검토는 관리 화면에서.
    const openCount = await prisma.report.count({
      where: { targetType: type, targetId, status: "open" },
    });
    let hidden = false;
    if (openCount >= REPORT_HIDE_THRESHOLD) {
      try {
        if (type === "store") {
          await prisma.store.update({ where: { id: targetId }, data: { status: "hidden" } });
        } else if (type === "sale") {
          await prisma.sale.update({ where: { id: targetId }, data: { status: "hidden" } });
        } else {
          await prisma.review.update({ where: { id: targetId }, data: { hidden: true } });
        }
        hidden = true;
      } catch {
        // 대상이 이미 없거나 숨김 → 무시
      }
    }

    return NextResponse.json({ ok: true, reportId: report.id, hidden });
  } catch {
    return NextResponse.json({ error: "접수에 실패했어요." }, { status: 500 });
  }
}
