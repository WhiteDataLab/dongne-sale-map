import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/** P1-7 동네 절약방 글 삭제 — 작성자 본인 또는 관리자. */
export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    const post = await prisma.neighborhoodPost.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!post) return NextResponse.json({ error: "글을 찾을 수 없어요." }, { status: 404 });
    if (post.authorId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
    }
    await prisma.neighborhoodPost.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
  }
}
