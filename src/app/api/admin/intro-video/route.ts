import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import { isAllowedVideoType, storageConfigured, uploadIntroVideo } from "@/lib/supabaseStorage";

/** 소개 페이지(/about) 영상 업로드/삭제 — 관리자 전용. SiteConfig(intro_video_url) 저장. */
export const runtime = "nodejs";

const KEY = "intro_video_url";
const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!storageConfigured()) {
    return NextResponse.json({ error: "스토리지 미설정" }, { status: 503 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "영상 파일이 필요해요." }, { status: 400 });
  }
  if (!isAllowedVideoType(file.type)) {
    return NextResponse.json({ error: "mp4/webm/mov 영상만 가능해요." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "영상은 50MB 이하만 가능해요." }, { status: 413 });
  }
  try {
    const url = await uploadIntroVideo(await file.arrayBuffer(), file.type);
    await prisma.siteConfig.upsert({
      where: { key: KEY },
      update: { value: url },
      create: { key: KEY, value: url },
    });
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ error: "업로드에 실패했어요." }, { status: 502 });
  }
}

export async function DELETE() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await prisma.siteConfig.deleteMany({ where: { key: KEY } });
  return NextResponse.json({ ok: true });
}
