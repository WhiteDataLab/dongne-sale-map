import { randomUUID } from "node:crypto";

/**
 * Supabase Storage 업로드 (서버 전용).
 * service_role 키는 절대 클라이언트로 나가면 안 되므로, 업로드는 항상 서버 라우트를 경유한다.
 * 키가 없으면(env 가드) configured=false → 라우트가 503 으로 안내.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "sale-photos";
const DOC_BUCKET = "merchant-docs"; // 비공개 — 사업자등록증 등 민감 문서

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

const DOC_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function isAllowedDocType(type: string): boolean {
  return type in DOC_EXT;
}

/** 사업자등록증 등 민감 문서를 **비공개** 버킷에 업로드 → 저장 경로 반환(공개 URL 아님). */
export async function uploadMerchantDoc(
  data: ArrayBuffer,
  contentType: string,
): Promise<string> {
  if (!storageConfigured()) throw new Error("storage_not_configured");
  const ext = DOC_EXT[contentType] ?? "bin";
  const path = `bizreg/${randomUUID()}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${DOC_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": contentType },
    body: Buffer.from(data),
  });
  if (!res.ok) throw new Error(`doc_upload_failed: ${res.status}`);
  return path;
}

/** 비공개 문서의 단기 서명 URL (관리자 열람용). 기본 5분. */
export async function createSignedDocUrl(
  path: string,
  expiresIn = 300,
): Promise<string | null> {
  if (!storageConfigured()) return null;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${DOC_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { signedURL?: string };
  return data.signedURL ? `${SUPABASE_URL}/storage/v1${data.signedURL}` : null;
}
