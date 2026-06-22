import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageMenu } from "@/lib/menu";
import { isPublicStorageUrl } from "@/lib/supabaseStorage";
import { getPointConfig } from "@/lib/pointConfig";

/** 메뉴(상품) 추가 (스펙 Phase 7b). 사진 필수. 권한: canManageMenu. */
export const runtime = "nodejs";

const RATE_WINDOW_MS = 5 * 60_000;
const RATE_MAX = 8; // 5분 내 메뉴 등록 상한(포인트 파밍·도배 방지)

type Body = {
  storeId?: string;
  name?: string;
  price?: number;
  qtyUnit?: string;
  photoUrl?: string;
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
  if (!storeId || !name?.trim()) {
    return NextResponse.json({ error: "메뉴명은 필수예요." }, { status: 400 });
  }
  if (!photoUrl || !isPublicStorageUrl(photoUrl)) {
    return NextResponse.json({ error: "메뉴 사진은 필수예요." }, { status: 400 });
  }
  if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price < 0) {
    return NextResponse.json({ error: "가격을 확인해 주세요." }, { status: 400 });
  }
  const price = body.price;
  const stock = typeof body.stock === "number" ? body.stock : null;

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }
    if (!canManageMenu(store, user)) {
      return NextResponse.json({ error: "메뉴를 등록할 권한이 없어요." }, { status: 403 });
    }
    // 어뷰징 방어: 단시간 다중 등록 레이트리밋(+5P 파밍 방지)
    const recent = await prisma.product.count({
      where: { createdById: user.id, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
    });
    if (recent >= RATE_MAX) {
      return NextResponse.json({ error: "잠시 후 다시 시도해 주세요. (너무 빠른 연속 등록)" }, { status: 429 });
    }
    const productPoint = (await getPointConfig()).product;
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          storeId,
          name: name.trim().slice(0, 100),
          price,
          qtyUnit: (qtyUnit?.trim() || "").slice(0, 40),
          photoUrl,
          origin: origin?.trim().slice(0, 60) || null,
          stock,
          createdById: user.id,
        },
      });
      // 메뉴 등록 적립(pending) — 커뮤니티 메뉴 채우기 유도
      await tx.pointLog.create({
        data: {
          userId: user.id,
          amount: productPoint,
          reason: "메뉴 등록",
          status: "pending",
          refType: "product",
          refId: created.id,
        },
      });
      return created;
    });
    return NextResponse.json({ ok: true, productId: product.id, pointPending: productPoint });
  } catch {
    return NextResponse.json({ error: "메뉴 등록에 실패했어요." }, { status: 500 });
  }
}
