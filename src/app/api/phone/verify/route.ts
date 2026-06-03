import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCode, normalizePhone } from "@/lib/sms";

/**
 * 전화번호 인증번호 검증 (Phase 5). 성공 시 해당 PhoneVerification.verified=true.
 * 이 "검증됨" 상태를 5b 의 전화번호 로그인(Credentials)에서 소비한다.
 */
export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string };
  try {
    body = (await req.json()) as { phone?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
  const code = (body.code ?? "").trim();
  if (!phone || !/^\d{4,6}$/.test(code)) {
    return NextResponse.json({ error: "번호와 인증번호를 확인해 주세요." }, { status: 400 });
  }

  try {
    const record = await prisma.phoneVerification.findFirst({
      where: { phone, verified: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record) {
      return NextResponse.json(
        { error: "인증번호가 만료됐어요. 다시 받아주세요." },
        { status: 410 },
      );
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "시도 횟수를 초과했어요. 다시 받아주세요." },
        { status: 429 },
      );
    }

    if (record.codeHash !== hashCode(phone, code)) {
      await prisma.phoneVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json({ error: "인증번호가 일치하지 않아요." }, { status: 401 });
    }

    await prisma.phoneVerification.update({
      where: { id: record.id },
      data: { verified: true },
    });

    // 이미 가입된 번호인지 → 가입(닉네임 입력) 단계 노출 여부 결정
    const registered = Boolean(
      await prisma.identity.findUnique({
        where: { provider_providerId: { provider: "phone", providerId: phone } },
      }),
    );
    return NextResponse.json({ ok: true, verified: true, registered });
  } catch {
    return NextResponse.json({ error: "검증에 실패했어요." }, { status: 500 });
  }
}
