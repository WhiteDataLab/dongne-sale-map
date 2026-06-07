import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";

/** 공지/이벤트 수정·삭제 — 관리자 전용. */
export const runtime = "nodejs";

type Body = { kind?: string; title?: string; body?: string; pinned?: boolean; active?: boolean };

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const data: {
    kind?: "notice" | "event";
    title?: string;
    body?: string;
    pinned?: boolean;
    active?: boolean;
  } = {};
  if (b.kind !== undefined) data.kind = b.kind === "event" ? "event" : "notice";
  if (typeof b.title === "string") {
    if (!b.title.trim()) return NextResponse.json({ error: "제목은 필수예요." }, { status: 400 });
    data.title = b.title.trim().slice(0, 200);
  }
  if (typeof b.body === "string") {
    if (!b.body.trim()) return NextResponse.json({ error: "내용은 필수예요." }, { status: 400 });
    data.body = b.body.trim().slice(0, 5000);
  }
  if (typeof b.pinned === "boolean") data.pinned = b.pinned;
  if (typeof b.active === "boolean") data.active = b.active;

  try {
    await prisma.notice.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "수정에 실패했어요." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  try {
    await prisma.notice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
  }
}
