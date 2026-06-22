import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { isPublicStorageUrl } from "@/lib/supabaseStorage";
import { getSiteSettings } from "@/lib/siteSettings";

/** 고객센터 1:1 문의 등록. 로그인 필요. */
export const runtime = "nodejs";

const RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let b: { nickname?: string; email?: string; title?: string; content?: string; attachmentUrls?: unknown };
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
  if (nickname.length > 30 || title.length > 200 || content.length > 5000 || email.length > 200) {
    return NextResponse.json({ error: "입력 길이가 너무 길어요." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });
  }
  // 첨부 이미지는 우리 공개 스토리지 URL만 인정(위조 URL 차단), 최대 5장.
  const attachmentUrls = Array.isArray(b.attachmentUrls)
    ? b.attachmentUrls.filter((u): u is string => typeof u === "string" && isPublicStorageUrl(u)).slice(0, 5)
    : [];

  // 도배 방지 레이트리밋
  const recent = await prisma.inquiry.count({
    where: { userId, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
  });
  if (recent >= (await getSiteSettings()).rateInquiry) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  try {
    const inquiry = await prisma.inquiry.create({
      data: { userId, nickname, email, title, content, attachmentUrls },
    });
    return NextResponse.json({ ok: true, id: inquiry.id });
  } catch {
    return NextResponse.json({ error: "문의 접수에 실패했어요." }, { status: 500 });
  }
}
