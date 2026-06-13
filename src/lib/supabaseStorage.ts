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
const INTRO_BUCKET = "intro"; // 공개 — 소개 페이지 영상

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

/**
 * 파일의 **매직바이트(시그니처)** 로 실제 이미지 타입을 판별한다.
 * 클라이언트가 보내는 MIME 헤더(`file.type`)는 위조 가능하므로, 실제 바이트로 재확인한다.
 * 허용 외 타입(스크립트/HTML/SVG 등을 image 로 위장)을 스토리지에 올리는 것을 차단.
 * @returns 판별된 MIME (png/jpeg/webp/gif) 또는 null(이미지 아님)
 */
export function sniffImageMime(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf.slice(0, 16));
  if (b.length < 12) return null;
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  // GIF: 47 49 46 38 ("GIF8")
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  // WEBP: "RIFF"...."WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** 이미지 또는 PDF(%PDF) 매직바이트 판별 — 사업자등록증 등 민감문서 업로드용. */
export function sniffDocMime(buf: ArrayBuffer): string | null {
  const img = sniffImageMime(buf);
  if (img) return img;
  const b = new Uint8Array(buf.slice(0, 5));
  // PDF: 25 50 44 46 ("%PDF")
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  return null;
}

/** 우리 공개 스토리지에서 발급된 URL인지 검증(외부/위조 URL로 포인트 우회 방지). */
export function isPublicStorageUrl(url: string): boolean {
  if (!SUPABASE_URL || typeof url !== "string") return false;
  return url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/`);
}

/** 공개 스토리지 이미지 삭제(용량 정리). 우리 URL만, 실패해도 무시(best-effort). */
export async function deletePublicImage(url: string | null | undefined): Promise<void> {
  if (!url || !storageConfigured() || !isPublicStorageUrl(url)) return;
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const bucketAndPath = url.slice(idx + marker.length); // {bucket}/{path}
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${bucketAndPath}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
    });
  } catch {
    // 정리 실패는 무시
  }
}

/** 여러 장 한 번에 정리. */
export async function deletePublicImages(urls: (string | null | undefined)[]): Promise<void> {
  await Promise.all(urls.map((u) => deletePublicImage(u)));
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

/**
 * 리뷰 영수증을 **비공개** 버킷에 업로드 → 저장 경로 반환(공개 URL 아님).
 * 영수증엔 카드/상호/시간 등 민감정보가 있어 공개 노출하지 않고 인증 배지로만 쓴다.
 */
export async function uploadReceiptImage(data: ArrayBuffer, contentType: string): Promise<string> {
  if (!storageConfigured()) throw new Error("storage_not_configured");
  const ext = EXT_BY_TYPE[contentType] ?? "jpg";
  const path = `receipts/${randomUUID()}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${DOC_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": contentType },
    body: Buffer.from(data),
  });
  if (!res.ok) throw new Error(`receipt_upload_failed: ${res.status}`);
  return path;
}

/** 비공개 영수증 경로 형식 검증(위조 차단). */
export function isReceiptPath(p: string): boolean {
  return typeof p === "string" && /^receipts\/[\w-]+\.(png|jpg|webp|gif)$/.test(p);
}

const VIDEO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function isAllowedVideoType(type: string): boolean {
  return type in VIDEO_EXT;
}

/** 소개 페이지 영상 업로드(공개 버킷) → 공개 URL. */
export async function uploadIntroVideo(
  data: ArrayBuffer,
  contentType: string,
): Promise<string> {
  if (!storageConfigured()) throw new Error("storage_not_configured");
  const ext = VIDEO_EXT[contentType] ?? "mp4";
  const path = `videos/${randomUUID()}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${INTRO_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": contentType },
    body: Buffer.from(data),
  });
  if (!res.ok) throw new Error(`intro_upload_failed: ${res.status}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${INTRO_BUCKET}/${path}`;
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
