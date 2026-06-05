import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageMenu } from "@/lib/menu";

/** 메뉴(상품) 수정/삭제 (스펙 Phase 7b). 권한: canManageMenu. */
export const runtime = "nodejs";

async function loadAuthorized(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "login_required" as const, status: 401 };
  const product = await prisma.product.findUnique({
    where: { id },
    include: { store: { select: { ownerId: true, status: true } } },
  });
  if (!product) return { error: "메뉴를 찾을 수 없어요.", status: 404 };
  if (!canManageMenu(product.store, user)) {
    return { error: "권한이 없어요.", status: 403 };
  }
  return { product };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await loadAuthorized(id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: {
    name?: string;
    price?: number;
    qtyUnit?: string;
    photoUrl?: string;
    origin?: string;
    stock?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  try {
    await prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(typeof body.price === "number" ? { price: body.price } : {}),
        ...(body.qtyUnit !== undefined ? { qtyUnit: body.qtyUnit.trim() } : {}),
        ...(body.photoUrl !== undefined ? { photoUrl: body.photoUrl } : {}),
        ...(body.origin !== undefined ? { origin: body.origin?.trim() || null } : {}),
        ...(body.stock !== undefined ? { stock: body.stock } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "수정에 실패했어요." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await loadAuthorized(id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
  }
}
