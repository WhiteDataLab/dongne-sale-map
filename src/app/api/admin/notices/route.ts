import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";

/** 공지/이벤트 작성 — 관리자 전용. */
export const runtime = "nodejs";

type Body = { kind?: string; title?: string; body?: string; pinned?: boolean };

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const title = b.title?.trim();
  const body = b.body?.trim();
  if (!title || !body) {
    return NextResponse.json({ error: "제목과 내용은 필수예요." }, { status: 400 });
  }
  const kind = b.kind === "event" ? "event" : "notice";
  const notice = await prisma.notice.create({
    data: { kind, title: title.slice(0, 200), body: body.slice(0, 5000), pinned: Boolean(b.pinned) },
  });
  return NextResponse.json({ ok: true, id: notice.id });
}
