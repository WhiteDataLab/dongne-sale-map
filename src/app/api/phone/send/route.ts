import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ipLimit } from "@/lib/rateLimit";
import { generateCode, hashCode, isSmsDevMode, normalizePhone, sendSmsCode } from "@/lib/sms";
import { getSiteSettings } from "@/lib/siteSettings";

/**
 * 전화번호 인증번호 발송 (Phase 5, 로그인 전 단계).
 * 개발모드면 응답에 devCode 포함(실발송 없음).
 */
export const runtime = "nodejs";

const CODE_TTL_MS = 5 * 60 * 1000; // 5분
const RATE_WINDOW_MS = 60 * 1000; // 동일 번호 1분 내 발송 횟수 제한 (어뷰징 방어)

export async function POST(req: NextRequest) {
  // 번호를 바꿔가며 SMS 폭탄/발송비 남용하는 공격 방어: IP 기준 분당 5건
  // (번호별 제한은 아래에서 추가로 적용)
  const limited = await ipLimit(req, "sms-send", 5, 60_000);
  if (limited) return limited;

  let body: { phone?: string };
  try {
    body = (await req.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
  if (!phone) {
    return NextResponse.json({ error: "올바른 휴대폰 번호를 입력해 주세요." }, { status: 400 });
  }

  try {
    const recent = await prisma.phoneVerification.count({
      where: { phone, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
    });
    if (recent >= (await getSiteSettings()).ratePhone) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }

    const code = generateCode();
    await prisma.phoneVerification.create({
      data: {
        phone,
        codeHash: hashCode(phone, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    const { devCode } = await sendSmsCode(phone, code);
    return NextResponse.json({
      ok: true,
      dev: isSmsDevMode(),
      ...(devCode ? { devCode } : {}),
    });
  } catch {
    return NextResponse.json({ error: "발송에 실패했어요." }, { status: 502 });
  }
}
