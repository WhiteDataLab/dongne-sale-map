import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import {
  isAllowedDocType,
  sniffDocMime,
  storageConfigured,
  uploadMerchantDoc,
} from "@/lib/supabaseStorage";

/**
 * 사장님 인증 신청 (Phase 7a). 사업자등록증 이미지를 비공개 버킷에 올리고
 * MerchantVerification(pending) 생성 → 관리자가 /admin/merchants 에서 수동 승인.
 */
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }
  if (!storageConfigured()) {
    return NextResponse.json({ error: "스토리지가 설정되지 않았어요." }, { status: 503 });
  }

  const form = await req.formData();
  const storeId = String(form.get("storeId") ?? "");
  const file = form.get("file");
  if (!storeId) {
    return NextResponse.json({ error: "가게 정보가 필요해요." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "사업자등록증 파일이 필요해요." }, { status: 400 });
  }
  if (!isAllowedDocType(file.type)) {
    return NextResponse.json(
      { error: "이미지(png/jpg/webp) 또는 PDF만 올릴 수 있어요." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "파일은 5MB 이하만 가능해요." }, { status: 413 });
  }

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.status !== "active") {
      return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
    }
    if (store.ownerId) {
      return NextResponse.json(
        { error: "이미 사장님이 인증된 가게예요." },
        { status: 409 },
      );
    }
    const dup = await prisma.merchantVerification.findFirst({
      where: { userId, storeId, status: "pending" },
    });
    if (dup) {
      return NextResponse.json(
        { error: "이미 신청했어요. 관리자 검토 중이에요." },
        { status: 409 },
      );
    }

    // 매직바이트로 실제 이미지/PDF인지 재확인(MIME 헤더 위조 차단).
    const buf = await file.arrayBuffer();
    const realType = sniffDocMime(buf);
    if (!realType || !isAllowedDocType(realType)) {
      return NextResponse.json(
        { error: "실제 이미지(png/jpg/webp) 또는 PDF 파일만 올릴 수 있어요." },
        { status: 415 },
      );
    }
    const docPath = await uploadMerchantDoc(buf, realType);
    await prisma.merchantVerification.create({
      data: { userId, storeId, docPath },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "신청에 실패했어요." }, { status: 500 });
  }
}
