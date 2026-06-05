import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import { parseAbout, type AboutContent } from "@/lib/about";

/** 서비스 소개(/about) 콘텐츠 저장 — 관리자 전용. SiteConfig(about_content) JSON. */
export const runtime = "nodejs";

const KEY = "about_content";

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  // parseAbout 로 정규화(누락 필드 기본값 보정, 블록 정리) 후 저장
  const content: AboutContent = parseAbout(JSON.stringify(body));
  try {
    const value = JSON.stringify(content);
    await prisma.siteConfig.upsert({
      where: { key: KEY },
      update: { value },
      create: { key: KEY, value },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "저장에 실패했어요." }, { status: 500 });
  }
}
