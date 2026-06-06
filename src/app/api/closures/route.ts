import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { isPublicStorageUrl } from "@/lib/supabaseStorage";

/** 소비자 휴업/폐업 제보 (사진 첨부). 로그인 필요. 지도·상세에 경고로 노출. */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let body: { storeId?: string; kind?: string; photoUrl?: string | null; note?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const storeId = String(body.storeId ?? "");
  const kind = body.kind === "shutdown" ? "shutdown" : body.kind === "closed_today" ? "closed_today" : null;
  if (!storeId || !kind) {
    return NextResponse.json({ error: "제보 종류와 가게가 필요해요." }, { status: 400 });
  }

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { status: true } });
    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }
    // 중복 도배 방지: 같은 사용자가 같은 가게에 24시간 내 같은 종류 제보 1회
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dup = await prisma.closureReport.findFirst({
      where: { storeId, kind, createdById: userId, createdAt: { gte: dayAgo } },
    });
    if (dup) {
      return NextResponse.json({ error: "이미 제보했어요. 잠시 후 다시 시도해 주세요." }, { status: 409 });
    }

    await prisma.closureReport.create({
      data: {
        storeId,
        kind,
        photoUrl:
          typeof body.photoUrl === "string" && isPublicStorageUrl(body.photoUrl)
            ? body.photoUrl
            : null,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null,
        createdById: userId,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "제보에 실패했어요." }, { status: 500 });
  }
}
