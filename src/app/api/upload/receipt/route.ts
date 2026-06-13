import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { isAllowedImageType, storageConfigured, uploadReceiptImage } from "@/lib/supabaseStorage";

/**
 * 영수증 인증 이미지 업로드 (리뷰용). 비공개 버킷에 저장하고 **경로(path)** 만 반환.
 * 영수증은 민감정보라 공개 URL을 발급하지 않는다(인증 배지로만 사용).
 */
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const { ok, retryAfter } = rateLimit(`upload:${userId}`, 20, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "업로드가 너무 많아요. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  if (!storageConfigured()) {
    return NextResponse.json({ error: "스토리지가 설정되지 않았어요." }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "영수증 사진이 필요해요." }, { status: 400 });
  }
  if (!isAllowedImageType(file.type)) {
    return NextResponse.json({ error: "이미지 파일만 올릴 수 있어요." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "사진은 5MB 이하만 가능해요." }, { status: 413 });
  }

  try {
    const path = await uploadReceiptImage(await file.arrayBuffer(), file.type);
    return NextResponse.json({ path });
  } catch {
    return NextResponse.json({ error: "업로드에 실패했어요." }, { status: 502 });
  }
}
