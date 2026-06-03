import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/** 즐겨찾기 토글 (스펙 Phase 2 UI + Phase 5에서 영속화 연결). */
export const runtime = "nodejs";

type Body = { storeId?: string; on?: boolean };

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
  const { storeId, on } = body;
  if (!storeId) {
    return NextResponse.json({ error: "가게 정보가 필요해요." }, { status: 400 });
  }

  try {
    if (on) {
      await prisma.favorite.upsert({
        where: { userId_storeId: { userId, storeId } },
        update: {},
        create: { userId, storeId },
      });
    } else {
      await prisma.favorite.deleteMany({ where: { userId, storeId } });
    }
    return NextResponse.json({ ok: true, favorite: Boolean(on) });
  } catch {
    return NextResponse.json({ error: "즐겨찾기 처리에 실패했어요." }, { status: 500 });
  }
}
