import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import { isPublicStorageUrl } from "@/lib/supabaseStorage";

/** 기프티콘 상품 추가 — 관리자 전용. */
export const runtime = "nodejs";

/** 정산 금액 필드 정규화: 유효한 0 이상 정수만, 아니면 null. */
function intOrNull(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let b: {
    brand?: string;
    name?: string;
    points?: number;
    imageUrl?: string | null;
    emoji?: string;
    color?: string;
    sortOrder?: number;
    costKrw?: number | null;
    faceValueKrw?: number | null;
    partner?: string | null;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!b.brand?.trim() || !b.name?.trim()) {
    return NextResponse.json({ error: "브랜드·상품명은 필수예요." }, { status: 400 });
  }
  if (typeof b.points !== "number" || !Number.isInteger(b.points) || b.points <= 0) {
    return NextResponse.json({ error: "포인트(가격)를 확인해 주세요." }, { status: 400 });
  }
  if (b.imageUrl && !isPublicStorageUrl(b.imageUrl)) {
    return NextResponse.json({ error: "이미지 주소가 올바르지 않아요." }, { status: 400 });
  }
  const item = await prisma.giftItem.create({
    data: {
      brand: b.brand.trim(),
      name: b.name.trim(),
      points: b.points,
      imageUrl: b.imageUrl || null,
      emoji: b.emoji?.trim() || "🎁",
      color: b.color?.trim() || "#2563eb",
      sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : 100,
      costKrw: intOrNull(b.costKrw),
      faceValueKrw: intOrNull(b.faceValueKrw),
      partner: b.partner?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, id: item.id });
}
