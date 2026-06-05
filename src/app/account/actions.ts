"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth, signIn, signOut, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";

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
