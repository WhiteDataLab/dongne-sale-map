import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** 추천인 이벤트: 추천인·친구 각 +50P. */
export const REFERRAL_POINT = 50;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 문자(O,0,I,1) 제외

function genCode(len = 7): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/** 연락처(숫자) → 해시. 영구 원장에 원문 PII 대신 해시만 저장. */
function hashContact(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return createHash("sha256").update(`${digits}:${process.env.AUTH_SECRET ?? "salt"}`).digest("hex");
}

/** 사용자의 추천 코드를 보장(없으면 생성). 충돌 시 재시도. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (u?.referralCode) return u.referralCode;

  for (let i = 0; i < 6; i++) {
    const code = genCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // unique 충돌 → 재시도
    }
  }
  throw new Error("referral_code_gen_failed");
}

/**
 * 추천 보상 지급 조건이 충족되면 추천인·친구 각 +50P 지급.
 * 조건: 추천인(referredById) 있음 + 미지급(referralRewarded=false) + **연락처 등록됨**
 *       + 그 연락처가 과거에 추천 보상에 사용된 적 없음(영구 원장).
 * 악용 방어:
 *  - 연락처 미등록 → 양쪽 미지급
 *  - 같은 연락처 재사용(탈퇴 후 재가입 포함) → 미지급 + 소진 처리(다른 연락처로 우회 방지)
 * @returns 지급되었으면 true
 */
export async function grantReferralIfEligible(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true, referralRewarded: true, contactPhone: true, contactVerified: true },
  });
  // SMS 인증된 연락처가 있어야 보상(미인증/미등록이면 미지급)
  if (!u || !u.referredById || u.referralRewarded || !u.contactPhone || !u.contactVerified) return false;

  const hash = hashContact(u.contactPhone);
  const claimed = await prisma.referralClaim.findUnique({ where: { contactHash: hash } });
  if (claimed) {
    // 이미 이 연락처로 추천 보상을 받은 이력 → 보상 없이 소진 처리(우회 차단)
    await prisma.user.update({ where: { id: userId }, data: { referralRewarded: true } });
    return false;
  }

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { referralRewarded: true } }),
      prisma.referralClaim.create({ data: { contactHash: hash } }),
      prisma.pointLog.create({
        data: {
          userId: u.referredById,
          amount: REFERRAL_POINT,
          reason: "추천 보상 (친구 가입)",
          status: "pending",
          refType: "referral",
          refId: userId,
        },
      }),
      prisma.pointLog.create({
        data: {
          userId,
          amount: REFERRAL_POINT,
          reason: "추천인 코드 보상",
          status: "pending",
          refType: "referral",
          refId: u.referredById,
        },
      }),
    ]);
    return true;
  } catch {
    // referralClaim unique 동시성 충돌 등 → 미지급(안전)
    return false;
  }
}

export type ApplyResult = "granted" | "pending" | "self" | "invalid" | "already" | "none";

/**
 * 친구(referredUserId)가 추천 코드를 사용 → 추천 관계 설정(1회) 후 지급 조건이면 지급.
 * 연락처가 없으면 'pending'(연락처 등록 시 지급).
 */
export async function applyReferral(
  referredUserId: string,
  rawCode: string | null | undefined,
): Promise<ApplyResult> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code) return "none";

  const referrer = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
  if (!referrer) return "invalid";
  if (referrer.id === referredUserId) return "self";

  const me = await prisma.user.findUnique({
    where: { id: referredUserId },
    select: { referredById: true },
  });
  if (!me || me.referredById) return "already";

  // 추천 관계만 먼저 설정(보상은 연락처 등록 시점에 지급)
  await prisma.user.update({ where: { id: referredUserId }, data: { referredById: referrer.id } });

  const granted = await grantReferralIfEligible(referredUserId);
  return granted ? "granted" : "pending";
}
