import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import { liveCouponFilter, COUPON_TITLE_MAX, COUPON_TEXT_MAX, COUPON_MAX_DAYS } from "@/lib/coupons";

/**
 * M3(수익화) — 사장님 쿠폰 발행.
 * 발행/관리는 canManageStore(소유자·관리자)만. 만료는 expiresAt(시각) 기준 자동 비활성(Sale 패턴).
 */
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_PER_STORE = 20; // 한 가게 동시 활성 쿠폰 상한(스팸 방지)

type Body = {
  storeId?: string;
  title?: string;
  description?: string | null;
  condition?: string | null;
  totalLimit?: number | null;
  expiresAt?: string; // ISO
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

  const storeId = body.storeId;
  const title = body.title?.trim();
  if (!storeId || !title) {
    return NextResponse.json({ error: "가게·혜택 제목은 필수예요." }, { status: 400 });
  }

  // 만료 시각 검증
  const now = new Date();
  const t = body.expiresAt ? new Date(body.expiresAt) : null;
  if (!t || Number.isNaN(t.getTime())) {
    return NextResponse.json({ error: "마감일을 확인해 주세요." }, { status: 400 });
  }
  const ms = t.getTime() - now.getTime();
  if (ms <= 60_000) {
    return NextResponse.json({ error: "마감일은 현재 이후로 설정해 주세요." }, { status: 400 });
  }
  if (ms > COUPON_MAX_DAYS * DAY_MS) {
    return NextResponse.json({ error: `최대 ${COUPON_MAX_DAYS}일까지 설정할 수 있어요.` }, { status: 400 });
  }

  // 발행 수량 한도(선택)
  let totalLimit: number | null = null;
  if (body.totalLimit != null) {
    const n = Number(body.totalLimit);
    if (!Number.isInteger(n) || n < 1 || n > 100_000) {
      return NextResponse.json({ error: "발행 수량을 확인해 주세요." }, { status: 400 });
    }
    totalLimit = n;
  }

  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, status: true, ownerId: true },
    });
    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }
    if (!canManageStore(store, user)) {
      return NextResponse.json({ error: "사장님·관리자만 쿠폰을 발행할 수 있어요." }, { status: 403 });
    }

    const activeCount = await prisma.coupon.count({ where: { ...liveCouponFilter(now), storeId } });
    if (activeCount >= MAX_ACTIVE_PER_STORE) {
      return NextResponse.json(
        { error: `진행 중인 쿠폰이 너무 많아요. (최대 ${MAX_ACTIVE_PER_STORE}개)` },
        { status: 409 },
      );
    }

    const coupon = await prisma.coupon.create({
      data: {
        storeId,
        title: title.slice(0, COUPON_TITLE_MAX),
        description: body.description?.trim().slice(0, COUPON_TEXT_MAX) || null,
        condition: body.condition?.trim().slice(0, COUPON_TEXT_MAX) || null,
        totalLimit,
        expiresAt: t,
        createdById: user.id,
      },
    });
    return NextResponse.json({ ok: true, couponId: coupon.id });
  } catch {
    return NextResponse.json({ error: "쿠폰 발행에 실패했어요." }, { status: 500 });
  }
}
