import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import { isPublicStorageUrl } from "@/lib/supabaseStorage";

/** 기프티콘 상품 수정/삭제 — 관리자 전용. */
export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let b: {
    brand?: string;
    name?: string;
    points?: number;
    imageUrl?: string | null;
    emoji?: string;
    color?: string;
    active?: boolean;
    sortOrder?: number;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (b.brand !== undefined) data.brand = b.brand.trim();
  if (b.name !== undefined) data.name = b.name.trim();
  if (b.points !== undefined) {
    if (!Number.isInteger(b.points) || b.points <= 0) {
      return NextResponse.json({ error: "포인트(가격)를 확인해 주세요." }, { status: 400 });
    }
    data.points = b.points;
  }
  if (b.imageUrl !== undefined) {
    if (b.imageUrl && !isPublicStorageUrl(b.imageUrl)) {
      return NextResponse.json({ error: "이미지 주소가 올바르지 않아요." }, { status: 400 });
    }
    data.imageUrl = b.imageUrl || null;
  }
  if (b.emoji !== undefined) data.emoji = b.emoji.trim() || "🎁";
  if (b.color !== undefined) data.color = b.color.trim() || "#2563eb";
  if (b.active !== undefined) data.active = Boolean(b.active);
  if (b.sortOrder !== undefined && Number.isInteger(b.sortOrder)) data.sortOrder = b.sortOrder;

  try {
    await prisma.giftItem.update({ where: { id }, data });
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
    await prisma.giftItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
  }
}
