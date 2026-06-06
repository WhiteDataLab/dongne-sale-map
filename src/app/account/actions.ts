"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth, signIn, signOut, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPublicStorageUrl } from "@/lib/supabaseStorage";
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

/** 기프티콘 수령 연락처 등록/수정 (마이페이지). 빈 값이면 삭제. */
export async function updateContact(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const raw = String(formData.get("contact") ?? "").trim();
  if (!raw) {
    await prisma.user.update({ where: { id: userId }, data: { contactPhone: null } });
    revalidatePath("/account");
    return;
  }
  const phone = normalizePhone(raw);
  if (!phone) return; // 형식 오류 → 무시(클라에서 안내)
  await prisma.user.update({ where: { id: userId }, data: { contactPhone: phone } });
  // 연락처가 등록되면 보류된 추천 보상 지급 시도(영구 원장으로 재사용 차단)
  try {
    await grantReferralIfEligible(userId);
  } catch {
    // 보상 실패는 연락처 저장을 막지 않음
  }
  revalidatePath("/account");
  revalidatePath("/invite");
}

/** 프로필 사진 변경/삭제 (마이페이지). 세션 토큰도 갱신해 헤더/표시에 즉시 반영. */
export async function updateProfileImage(url: string | null) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  // 우리 스토리지 URL 또는 제거(null)만 허용(외부/위조 URL 차단)
  if (url !== null && !isPublicStorageUrl(url)) return;
  await prisma.user.update({ where: { id: userId }, data: { profileImgUrl: url } });
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
