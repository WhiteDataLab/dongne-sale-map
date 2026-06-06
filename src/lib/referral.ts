import { prisma } from "@/lib/prisma";

/** 추천인 이벤트: 추천인·친구 각 +50P. */
export const REFERRAL_POINT = 50;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 문자(O,0,I,1) 제외

function genCode(len = 7): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
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

export type ApplyResult = "ok" | "self" | "invalid" | "already" | "none";

/**
 * 친구(referredUserId)가 추천 코드를 사용 → 추천인·친구 각 +50P (1회).
 * - 코드 무효/본인/이미 추천받음 → 보상 없음.
 */
export async function applyReferral(referredUserId: string, rawCode: string | null | undefined): Promise<ApplyResult> {
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

  await prisma.$transaction([
    prisma.user.update({ where: { id: referredUserId }, data: { referredById: referrer.id } }),
    prisma.pointLog.create({
      data: {
        userId: referrer.id,
        amount: REFERRAL_POINT,
        reason: "추천 보상 (친구 가입)",
        status: "pending",
        refType: "referral",
        refId: referredUserId,
      },
    }),
    prisma.pointLog.create({
      data: {
        userId: referredUserId,
        amount: REFERRAL_POINT,
        reason: "추천인 코드 입력 보상",
        status: "pending",
        refType: "referral",
        refId: referrer.id,
      },
    }),
  ]);
  return "ok";
}
