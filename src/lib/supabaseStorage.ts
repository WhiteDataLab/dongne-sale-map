import { randomUUID } from "node:crypto";

/**
 * Supabase Storage 업로드 (서버 전용).
 * service_role 키는 절대 클라이언트로 나가면 안 되므로, 업로드는 항상 서버 라우트를 경유한다.
 * 키가 없으면(env 가드) configured=false → 라우트가 503 으로 안내.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "sale-photos";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function storageConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

export function isAllowedImageType(type: string): boolean {
  return type in EXT_BY_TYPE;
}

/** 이미지 업로드 → 공개 URL 반환. */
export async function uploadSaleImage(
  data: ArrayBuffer,
  contentType: string,
): Promise<string> {
  if (!storageConfigured()) {
    throw new Error("storage_not_configured");
  }
  const ext = EXT_BY_TYPE[contentType] ?? "jpg";
  const path = `sales/${randomUUID()}.${ext}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": contentType,
      "cache-control": "3600",
    },
    body: Buffer.from(data),
  });

  if (!res.ok) {
    throw new Error(`storage_upload_failed: ${res.status} ${await res.text()}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
