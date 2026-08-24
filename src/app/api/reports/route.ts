import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getSiteSettings } from "@/lib/siteSettings";

/**
 * 신고/정정 접수 (스펙 Phase 4).
 * Report 생성 후, 같은 대상에 open 신고가 임계치(기본 3) 이상이면 콘텐츠 자동 숨김(soft hide).
 * 사후 검토는 관리 화면(/admin/reports)에서.
 */
export const runtime = "nodejs";

const TARGET_TYPES = ["store", "sale", "review", "product", "reply", "post"] as const;
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
    // 어뷰징 방어: 한 사용자가 같은 대상을 중복 신고해 단독으로 임계치를 채우지 못하게.
    // (자동 숨김·포인트 회수의 악용 차단) → 임계치는 '서로 다른 신고자 수' 기준이 됨.
    const already = await prisma.report.findFirst({
      where: { targetType: type, targetId, reporterId: userId },
    });
    if (already) {
      return NextResponse.json({ ok: true, hidden: false, duplicate: true });
    }

    const report = await prisma.report.create({
      data: { targetType: type, targetId, reason: reason.trim(), reporterId: userId },
    });

    // 신고 누적 N명 → 콘텐츠 자동 숨김(soft hide), 사후 검토는 관리 화면에서.
    const openCount = await prisma.report.count({
      where: { targetType: type, targetId, status: "open" },
    });
    const threshold = (await getSiteSettings()).reportHideThreshold;
    let hidden = false;
    if (openCount >= threshold) {
      try {
        if (type === "store") {
          await prisma.store.update({ where: { id: targetId }, data: { status: "hidden" } });
        } else if (type === "sale") {
          await prisma.sale.update({ where: { id: targetId }, data: { status: "hidden" } });
          // 제재(신고 누적 숨김) 시 해당 제보 적립 포인트 회수
          await prisma.pointLog.deleteMany({ where: { refType: "sale", refId: targetId } });
        } else if (type === "product") {
          await prisma.product.update({ where: { id: targetId }, data: { hidden: true } });
          await prisma.pointLog.deleteMany({ where: { refType: "product", refId: targetId } });
        } else if (type === "reply") {
          // M10: 사장님 답글 자동 숨김(포인트 없음 → 회수 불필요).
          await prisma.reviewReply.update({ where: { id: targetId }, data: { hidden: true } });
        } else if (type === "post") {
          // P1-7: 동네 절약방 글 자동 숨김(포인트 없음 → 회수 불필요).
          await prisma.neighborhoodPost.update({ where: { id: targetId }, data: { hidden: true } });
        } else {
          await prisma.review.update({ where: { id: targetId }, data: { hidden: true } });
          // 제재 시 해당 리뷰 적립 포인트 회수
          await prisma.pointLog.deleteMany({ where: { refType: "review", refId: targetId } });
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
