import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import {
  isAllowedImageType,
  sniffImageMime,
  storageConfigured,
  uploadSaleImage,
} from "@/lib/supabaseStorage";

/** 제보 사진 업로드 (스펙 Phase 3). 서버 경유 → Supabase Storage. */
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }
  // 업로드 남용(고아 이미지 누적·스토리지 비용) 방어: 사용자당 분당 20장
  const { ok, retryAfter } = await rateLimit(`upload:${userId}`, 20, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "업로드가 너무 많아요. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  if (!storageConfigured()) {
    return NextResponse.json(
      { error: "스토리지가 설정되지 않았어요 (SUPABASE_URL/SERVICE_ROLE)." },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "사진 파일이 필요해요." }, { status: 400 });
  }
  if (!isAllowedImageType(file.type)) {
    return NextResponse.json(
      { error: "이미지 파일(png/jpg/webp/gif)만 올릴 수 있어요." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "사진은 5MB 이하만 가능해요." }, { status: 413 });
  }

  // 매직바이트로 실제 이미지인지 재확인(MIME 헤더 위조 차단). 저장 타입도 실제값 사용.
  const buf = await file.arrayBuffer();
  const realType = sniffImageMime(buf);
  if (!realType || !isAllowedImageType(realType)) {
    return NextResponse.json(
      { error: "실제 이미지 파일(png/jpg/webp/gif)만 올릴 수 있어요." },
      { status: 415 },
    );
  }

  try {
    const url = await uploadSaleImage(buf, realType);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "업로드에 실패했어요." }, { status: 502 });
  }
}
