import { createHash, randomInt } from "node:crypto";

/**
 * SMS 본인확인 (Phase 5). 개발모드(목업): 실제 발송 대신 서버 로그 + 응답에 코드 노출.
 * 실제 발송사(CoolSMS/알리고/SENS 등)는 SMS_PROVIDER 설정 시 연동 (TODO).
 */
export function isSmsDevMode(): boolean {
  return !process.env.SMS_PROVIDER;
}

/** "010-1234-5678" 등 → 숫자만. 유효하면 정규화 문자열, 아니면 null. */
export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (/^01[016789]\d{7,8}$/.test(digits)) return digits;
  return null;
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** 코드는 평문 저장 금지 → 솔트 해시. */
export function hashCode(phone: string, code: string): string {
  return createHash("sha256")
    .update(`${phone}:${code}:${process.env.AUTH_SECRET ?? "salt"}`)
    .digest("hex");
}

/** 인증번호 발송. 개발모드면 devCode 를 반환(테스트용), 운영이면 미반환. */
export async function sendSmsCode(
  phone: string,
  code: string,
): Promise<{ devCode?: string }> {
  if (isSmsDevMode()) {
    console.log(`[SMS:DEV] ${phone} → 인증번호 ${code}`);
    return { devCode: code };
  }
  // TODO(phase-5): 실제 발송사 연동 (SMS_PROVIDER 분기). 실패 시 throw.
  throw new Error("sms_provider_not_implemented");
}
