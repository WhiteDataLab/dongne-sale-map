import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { isPublicStorageUrl } from "@/lib/supabaseStorage";

/** 고객센터 1:1 문의 등록. 로그인 필요. */
export const runtime = "nodejs";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let b: { nickname?: string; email?: string; title?: string; content?: string; attachmentUrl?: string | null };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const nickname = (b.nickname ?? "").trim();
  const email = (b.email ?? "").trim();
  const title = (b.title ?? "").trim();
  const content = (b.content ?? "").trim();
  if (!nickname || !title || !content) {
    return NextResponse.json({ error: "닉네임·제목·내용은 필수예요." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });
  }
  const attachmentUrl =
    typeof b.attachmentUrl === "string" && isPublicStorageUrl(b.attachmentUrl) ? b.attachmentUrl : null;

  // 도배 방지 레이트리밋
  const recent = await prisma.inquiry.count({
    where: { userId, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
  });
  if (recent >= RATE_MAX) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  try {
    const inquiry = await prisma.inquiry.create({
      data: { userId, nickname, email, title, content, attachmentUrl },
    });
    return NextResponse.json({ ok: true, id: inquiry.id });
  } catch {
    return NextResponse.json({ error: "문의 접수에 실패했어요." }, { status: 500 });
  }
}
