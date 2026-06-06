"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth, signIn, signOut, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPublicStorageUrl, deletePublicImage } from "@/lib/supabaseStorage";
import { normalizePhone } from "@/lib/sms";
import { grantReferralIfEligible } from "@/lib/referral";

/** 닉네임 변경 (마이페이지). 세션 토큰도 갱신해 헤더/표시에 즉시 반영. */
export async function updateNickname(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const nickname = String(formData.get("nickname") ?? "").trim();
  if (!nickname || nickname.length > 20) return;

  await prisma.user.update({ where: { id: userId }, data: { nickname } });
  await unstable_update({ user: { name: nickname } }); // jwt trigger="update" → DB 최신값 반영
  revalidatePath("/account");
}

/** 연락처 삭제 (마이페이지). */
export async function removeContact() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.user.update({
    where: { id: userId },
    data: { contactPhone: null, contactVerified: false },
  });
  revalidatePath("/account");
}

/**
 * SMS 인증을 마친 연락처 저장 (마이페이지).
 * 해당 번호로 verified=true 인 PhoneVerification 이 있어야 저장된다(인증 증명).
 * 저장 시 보류된 추천 보상 지급(인증 연락처만 보상).
 */
export async function saveVerifiedContact(rawPhone: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "login_required" };
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "번호 형식을 확인해 주세요." };

  // 최근 인증 완료된 기록 확인
  const rec = await prisma.phoneVerification.findFirst({
    where: { phone, verified: true, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) return { ok: false, error: "휴대폰 인증을 먼저 완료해 주세요." };

  await prisma.user.update({
    where: { id: userId },
    data: { contactPhone: phone, contactVerified: true },
  });
  await prisma.phoneVerification.deleteMany({ where: { phone } }); // 1회용 소비

  try {
    await grantReferralIfEligible(userId);
  } catch {
    // 보상 실패는 연락처 저장을 막지 않음
  }
  revalidatePath("/account");
  revalidatePath("/invite");
  return { ok: true };
}

/** 프로필 사진 변경/삭제 (마이페이지). 세션 토큰도 갱신해 헤더/표시에 즉시 반영. */
export async function updateProfileImage(url: string | null) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  // 우리 스토리지 URL 또는 제거(null)만 허용(외부/위조 URL 차단)
  if (url !== null && !isPublicStorageUrl(url)) return;
  const prev = await prisma.user.findUnique({ where: { id: userId }, select: { profileImgUrl: true } });
  await prisma.user.update({ where: { id: userId }, data: { profileImgUrl: url } });
  // 이전 프로필 사진 정리(바뀐 경우)
  if (prev?.profileImgUrl && prev.profileImgUrl !== url) {
    await deletePublicImage(prev.profileImgUrl);
  }
  await unstable_update({ user: {} }); // jwt trigger="update" → DB 의 profileImgUrl 재반영
  revalidatePath("/account");
}

/**
 * 소셜 계정 연결 시작 (account linking, Phase 5b).
 * 로그인 상태에서 link_uid 쿠키를 심고 OAuth 시작 → jwt 콜백이 현재 User 에 신원을 붙인다.
 */
export async function startLink(provider: "kakao" | "naver") {
  const session = await auth();
  if (!session?.user?.id) return;
  (await cookies()).set("link_uid", session.user.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  await signIn(provider, { redirectTo: "/account" });
}

/**
 * 회원 탈퇴 + 개인정보 삭제 (스펙 Phase 4 / 6장: 탈퇴 시 즉시 파기).
 * - 본인 작성 콘텐츠(가게/상품/세일)는 시스템 sentinel 로 익명화(커뮤니티 데이터 보존).
 * - 리뷰/즐겨찾기/포인트로그/신고는 User 삭제 시 cascade 로 함께 제거.
 * - User 행 삭제로 PII(닉네임/프로필/providerId) 파기.
 */
export async function deleteAccount() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;

  const ghost =
    (await prisma.user.findFirst({ where: { providerId: "deleted-user" } })) ??
    (await prisma.user.create({
      data: { provider: "kakao", providerId: "deleted-user", nickname: "탈퇴한 사용자" },
    }));

  // 탈퇴 통계 로그(PII 없이 시각+가입경로만) — 대시보드 추이용
  const leaving = await prisma.user.findUnique({
    where: { id: userId },
    select: { provider: true },
  });
  await prisma.withdrawalLog.create({ data: { provider: leaving?.provider ?? null } });

  await prisma.$transaction([
    prisma.store.updateMany({ where: { createdById: userId }, data: { createdById: ghost.id } }),
    prisma.product.updateMany({ where: { createdById: userId }, data: { createdById: ghost.id } }),
    prisma.sale.updateMany({ where: { createdById: userId }, data: { createdById: ghost.id } }),
  ]);

  await prisma.user.delete({ where: { id: userId } });

  await signOut({ redirectTo: "/" });
}
