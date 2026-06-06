import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { applyReferral } from "@/lib/referral";

/**
 * 추천인 코드 직접 입력(링크 없이 가입한 신규 회원용).
 * 어뷰징 방어: 가입 후 7일 이내 + 아직 추천인 미등록 + 본인 코드 아님.
 */
export const runtime = "nodejs";

const GRACE_DAYS = 7;

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const code = String(body.code ?? "").trim();
  if (!code) return NextResponse.json({ error: "추천 코드를 입력해 주세요." }, { status: 400 });

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true, createdAt: true },
  });
  if (!me) return NextResponse.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
  if (me.referredById) {
    return NextResponse.json({ error: "이미 추천인이 등록돼 있어요." }, { status: 409 });
  }
  const ageDays = (Date.now() - me.createdAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays > GRACE_DAYS) {
    return NextResponse.json(
      { error: `추천 코드는 가입 후 ${GRACE_DAYS}일 이내에만 입력할 수 있어요.` },
      { status: 403 },
    );
  }

  const result = await applyReferral(userId, code);
  switch (result) {
    case "granted":
      return NextResponse.json({ ok: true, message: "추천 보상 +50P! 친구에게도 +50P 지급됐어요." });
    case "pending":
      return NextResponse.json({
        ok: true,
        pending: true,
        message: "추천인 등록 완료! 마이페이지에서 연락처를 등록하면 +50P가 지급돼요.",
      });
    case "self":
      return NextResponse.json({ error: "본인 코드는 사용할 수 없어요." }, { status: 400 });
    case "invalid":
      return NextResponse.json({ error: "존재하지 않는 추천 코드예요." }, { status: 404 });
    case "already":
      return NextResponse.json({ error: "이미 추천인이 등록돼 있어요." }, { status: 409 });
    default:
      return NextResponse.json({ error: "처리에 실패했어요." }, { status: 400 });
  }
}
