import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

/**
 * 소셜 신원(provider, providerId) → User 해석.
 * Identity 가 단일 출처: 있으면 그 User, 없으면 User + Identity 신규 생성.
 * (전화번호 로그인/계정 연결도 같은 Identity 구조를 공유 — Phase 5b)
 */
export async function resolveSocialUser(
  provider: "kakao" | "naver",
  providerId: string,
  profile: { nickname: string; profileImgUrl: string | null },
): Promise<User> {
  const existing = await prisma.identity.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: true },
  });

  if (existing) {
    // 기존 신원 로그인: 닉네임/프로필을 provider 값으로 덮어쓰지 않는다.
    // → 병합 기준(연동을 시작한 계정)의 닉네임이 유지된다. (사용자 요청)
    return existing.user;
  }

  return prisma.user.create({
    data: {
      provider, // 레거시 표시용 컬럼도 채워둠
      providerId,
      nickname: profile.nickname,
      profileImgUrl: profile.profileImgUrl,
      identities: { create: { provider, providerId } },
    },
  });
}

/**
 * 전화번호 신원 → User. Identity(phone, 전화번호) 있으면 그 User, 없으면 신규(간단가입).
 */
export async function resolvePhoneUser(
  phone: string,
  profile: { nickname: string | null; name: string | null },
): Promise<User> {
  const existing = await prisma.identity.findUnique({
    where: { provider_providerId: { provider: "phone", providerId: phone } },
    include: { user: true },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.userId },
      data: { phoneVerified: true },
    });
  }
  return prisma.user.create({
    data: {
      provider: "phone",
      providerId: phone,
      phone,
      phoneVerified: true,
      nickname: profile.nickname?.trim() || "이웃",
      name: profile.name?.trim() || null,
      identities: { create: { provider: "phone", providerId: phone } },
    },
  });
}

/**
 * 로그인된 사용자에 소셜 신원을 연결하거나, 그 신원이 다른 계정 소유면 **두 계정을 병합**한다.
 * (사용자 요청: 별개 가입한 네이버/카카오/전화 계정을 연동 시 포인트 합산 + 즐겨찾기 통합)
 *
 * 병합: 상대 계정의 신원·포인트로그·리뷰·즐겨찾기·작성물·신고를 현재 계정으로 이전한 뒤 상대 계정 삭제.
 * 포인트 잔액의 출처는 PointLog 이므로, 로그를 옮기면 합산이 자동으로 맞는다.
 */
export async function linkOrMergeIdentity(
  currentUserId: string,
  provider: "kakao" | "naver",
  providerId: string,
): Promise<{ status: "linked" | "already" | "merged" | "error"; user: User | null }> {
  const current = await prisma.user.findUnique({ where: { id: currentUserId } });
  if (!current) return { status: "error", user: null };

  const existing = await prisma.identity.findUnique({
    where: { provider_providerId: { provider, providerId } },
  });

  if (!existing) {
    await prisma.identity.create({ data: { userId: currentUserId, provider, providerId } });
    return { status: "linked", user: current };
  }
  if (existing.userId === currentUserId) {
    return { status: "already", user: current };
  }

  // 다른 계정 소유 → 병합 (OAuth 로 본인 소유가 증명된 계정이므로 합친다)
  const otherId = existing.userId;
  const merged = await prisma.$transaction(async (tx) => {
    // 즐겨찾기: 중복(같은 가게)은 건너뛰고 현재 계정으로 복제 (원본은 상대 삭제 시 cascade)
    const otherFavs = await tx.favorite.findMany({ where: { userId: otherId } });
    if (otherFavs.length > 0) {
      await tx.favorite.createMany({
        data: otherFavs.map((f) => ({ userId: currentUserId, storeId: f.storeId })),
        skipDuplicates: true,
      });
    }
    // 포인트로그·리뷰·신원·작성물·신고 이전
    await tx.pointLog.updateMany({ where: { userId: otherId }, data: { userId: currentUserId } });
    await tx.review.updateMany({ where: { userId: otherId }, data: { userId: currentUserId } });
    await tx.identity.updateMany({ where: { userId: otherId }, data: { userId: currentUserId } });
    await tx.store.updateMany({ where: { createdById: otherId }, data: { createdById: currentUserId } });
    await tx.product.updateMany({ where: { createdById: otherId }, data: { createdById: currentUserId } });
    await tx.sale.updateMany({ where: { createdById: otherId }, data: { createdById: currentUserId } });
    await tx.report.updateMany({ where: { reporterId: otherId }, data: { reporterId: currentUserId } });

    // 표시 캐시 합산 + 상대 계정 삭제 (잔액의 실제 출처는 PointLog)
    const other = await tx.user.findUnique({ where: { id: otherId } });
    const updated = await tx.user.update({
      where: { id: currentUserId },
      data: { points: current.points + (other?.points ?? 0) },
    });
    await tx.user.delete({ where: { id: otherId } });
    return updated;
  });

  return { status: "merged", user: merged };
}
