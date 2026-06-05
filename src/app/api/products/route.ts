import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageMenu } from "@/lib/menu";

/** 메뉴(상품) 추가 (스펙 Phase 7b). 사진 필수. 권한: canManageMenu. */
export const runtime = "nodejs";

type Body = {
  storeId?: string;
  name?: string;
  price?: number;
  qtyUnit?: string;
  photoUrl?: string;
  videoUrl?: string;
  origin?: string;
  stock?: number | null;
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const { storeId, name, qtyUnit, photoUrl, origin } = body;
  if (!storeId || !name?.trim() || !qtyUnit?.trim()) {
    return NextResponse.json({ error: "메뉴명·단위는 필수예요." }, { status: 400 });
  }
  if (!photoUrl) {
    return NextResponse.json({ error: "메뉴 사진은 필수예요." }, { status: 400 });
  }
  if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price < 0) {
    return NextResponse.json({ error: "가격을 확인해 주세요." }, { status: 400 });
  }

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }
    if (!canManageMenu(store, user)) {
      return NextResponse.json({ error: "메뉴를 등록할 권한이 없어요." }, { status: 403 });
    }
    const product = await prisma.product.create({
      data: {
        storeId,
        name: name.trim(),
        price: body.price,
        qtyUnit: qtyUnit.trim(),
        photoUrl,
        videoUrl: body.videoUrl?.trim() || null,
        origin: origin?.trim() || null,
        stock: typeof body.stock === "number" ? body.stock : null,
        createdById: user.id,
      },
    });
    return NextResponse.json({ ok: true, productId: product.id });
  } catch {
    return NextResponse.json({ error: "메뉴 등록에 실패했어요." }, { status: 500 });
  }
}
