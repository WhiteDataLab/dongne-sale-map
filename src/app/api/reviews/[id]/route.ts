import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { deletePublicImages } from "@/lib/supabaseStorage";

/** 리뷰 삭제 (작성자 본인 또는 관리자). 적립 포인트 회수 + 사진 정리. */
export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    const review = await prisma.review.findUnique({ where: { id }, select: { userId: true, photoUrls: true } });
    if (!review) return NextResponse.json({ error: "리뷰를 찾을 수 없어요." }, { status: 404 });
    if (review.userId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "삭제할 권한이 없어요." }, { status: 403 });
    }
    await prisma.$transaction([
      prisma.pointLog.deleteMany({ where: { refType: "review", refId: id } }),
      prisma.review.delete({ where: { id } }),
    ]);
    await deletePublicImages(review.photoUrls);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
  }
}
