import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { asStoreHours, minutesUntilClose } from "@/lib/businessHours";

/**
 * 세일 제보 (스펙 Phase 3).
 * - 사진 필수 + 제목 + 세일가 + 수량 + 만료(1h/2h/마감까지)
 * - 제보 시 PointLog(pending) 적립 로그 생성 (실지급 없음)
 * - 같은 항목 중복 세일 → 409 "이미 세일중"(정정 진입점은 클라이언트에서 /api/reports)
 * - 어뷰징 방어: 단시간 다중 제보 레이트리밋
 */
export const runtime = "nodejs";

const POINT_SALE_REPORT = 10; // 제보 적립(표시용, status=pending)
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;

type Body = {
  storeId?: string;
  productId?: string | null;
  title?: string;
  salePrice?: number;
  qty?: string;
  expiresOption?: "1h" | "2h" | "close";
  photoUrl?: string;
};

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const { storeId, productId, title, salePrice, qty, expiresOption, photoUrl } = body;

  if (!storeId || !title?.trim() || !qty?.trim() || !photoUrl) {
    return NextResponse.json(
      { error: "사진·제목·수량은 필수예요." },
      { status: 400 },
    );
  }
  if (typeof salePrice !== "number" || !Number.isFinite(salePrice) || salePrice < 0) {
    return NextResponse.json({ error: "세일가를 확인해 주세요." }, { status: 400 });
  }
  const option = expiresOption ?? "close";

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }

    // 레이트리밋: 최근 1분 내 제보 RATE_MAX 건 초과 차단
    const recent = await prisma.sale.count({
      where: { createdById: userId, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
    });
    if (recent >= RATE_MAX) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해 주세요. (너무 빠른 연속 제보)" },
        { status: 429 },
      );
    }

    // 중복 세일: 같은 가게에서 (상품 지정 시 동일 상품 / 아니면 동일 제목) 활성 세일 존재
    const now = new Date();
    const dup = await prisma.sale.findFirst({
      where: {
        storeId,
        status: "active",
        expiresAt: { gt: now },
        ...(productId ? { productId } : { title: title.trim() }),
      },
    });
    if (dup) {
      return NextResponse.json(
        { error: "이미 세일중이에요.", duplicate: true, saleId: dup.id },
        { status: 409 },
      );
    }

    // 만료시간 계산
    let expiresAt: Date;
    if (option === "1h") expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    else if (option === "2h") expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    else {
      const mins = minutesUntilClose(asStoreHours(store.hoursJson), now);
      expiresAt = new Date(now.getTime() + (mins ?? 120) * 60 * 1000); // 정보없음 → 2시간
    }

    // 세일 + 적립로그(pending) 동시 생성
    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          storeId,
          productId: productId ?? null,
          title: title.trim(),
          photoUrl,
          salePrice,
          qty: qty.trim(),
          expiresAt,
          createdById: userId,
        },
      });
      await tx.pointLog.create({
        data: {
          userId,
          amount: POINT_SALE_REPORT,
          reason: "세일 제보",
          status: "pending",
          refType: "sale",
          refId: created.id,
        },
      });
      return created;
    });

    return NextResponse.json({ ok: true, saleId: sale.id, pointPending: POINT_SALE_REPORT });
  } catch {
    return NextResponse.json({ error: "제보 등록에 실패했어요." }, { status: 500 });
  }
}
