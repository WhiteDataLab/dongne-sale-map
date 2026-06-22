"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import {
  liveSponsorFilter,
  trialEndDate,
  extendPaidDate,
} from "@/lib/sponsors";
import { getSiteSettings } from "@/lib/siteSettings";
import { setLaunchFlag, type LaunchFlags } from "@/lib/launchFlags";
import { setPointConfig, POINT_CONFIG_META, type PointConfig } from "@/lib/pointConfig";
import {
  setSiteSetting,
  SETTINGS_META,
  type SiteSettings,
  type SettingsGroup,
} from "@/lib/siteSettings";

/** 모든 관리 액션은 호출 시 관리자 권한을 재확인한다(폼에서 직접 호출될 수 있으므로). */
async function ensureAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("forbidden");
}

/** 운영 무료 오픈 모드 플래그 토글(monetization / reservations). */
export async function toggleLaunchFlag(formData: FormData) {
  await ensureAdmin();
  const key = String(formData.get("key")) as keyof LaunchFlags;
  if (key !== "monetization" && key !== "reservations" && key !== "pointshop") {
    throw new Error("bad_key");
  }
  const on = String(formData.get("on")) === "1";
  await setLaunchFlag(key, on);
  revalidatePath("/admin/launch");
}

/** 적립 포인트 수치 일괄 저장(리뷰·제보·메뉴·추천·출석). 비정상 값은 무시(기존 유지). */
export async function savePointConfig(formData: FormData) {
  await ensureAdmin();
  for (const { key } of POINT_CONFIG_META) {
    const raw = formData.get(key);
    if (raw == null) continue;
    const n = Number(String(raw).trim());
    if (!Number.isFinite(n) || n < 0) continue;
    await setPointConfig(key as keyof PointConfig, n);
  }
  revalidatePath("/admin/points");
}

/** 사이트 설정(운영/요금/광고·예약) 그룹 단위 저장. 비정상 값은 무시(기존 유지). */
export async function saveSiteSettings(formData: FormData) {
  await ensureAdmin();
  const group = String(formData.get("__group")) as SettingsGroup;
  const fields = SETTINGS_META.filter((m) => m.group === group);
  for (const { key } of fields) {
    const raw = formData.get(key);
    if (raw == null) continue;
    const n = Number(String(raw).trim());
    if (!Number.isFinite(n) || n < 0) continue;
    await setSiteSetting(key as keyof SiteSettings, n);
  }
  revalidatePath(`/admin/${group === "ops" ? "settings" : group === "pricing" ? "pricing" : "params"}`);
}

/**
 * 임시 보관(held) 리뷰 복원 → 공개 노출. 잘못 격리된 경우를 위해 점수·적립도 살린다.
 * (작성 시 held 면 scored=false·미적립이었으므로, 복원 시 scored=true + 적립 1회 생성)
 */
export async function releaseHeldReview(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const r = await prisma.review.findUnique({
    where: { id },
    select: { id: true, userId: true, photoUrls: true, createdAt: true, held: true },
  });
  if (!r || !r.held) return;
  const { reviewGrant, getPointConfig } = await import("@/lib/pointConfig");
  const already = await prisma.pointLog.findFirst({ where: { refType: "review", refId: id } });
  const isFirst =
    (await prisma.review.count({ where: { userId: r.userId, createdAt: { lt: r.createdAt } } })) === 0;
  const base = (await getPointConfig()).review;
  const grant = already ? 0 : reviewGrant(base, isFirst, r.photoUrls.length > 0);
  await prisma.$transaction(async (tx) => {
    await tx.review.update({
      where: { id },
      data: { held: false, heldReason: null, heldAt: null, scored: true },
    });
    if (grant > 0) {
      await tx.pointLog.create({
        data: { userId: r.userId, amount: grant, reason: "리뷰 복원 적립", status: "pending", refType: "review", refId: id },
      });
    }
  });
  revalidatePath("/admin/quarantine");
}

/** 임시 보관 리뷰 삭제(스팸 확정). 적립 회수 + 사진 정리. */
export async function deleteHeldReview(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const r = await prisma.review.findUnique({ where: { id }, select: { photoUrls: true } });
  if (!r) return;
  await prisma.$transaction([
    prisma.pointLog.deleteMany({ where: { refType: "review", refId: id } }),
    prisma.review.delete({ where: { id } }),
  ]);
  if (r.photoUrls.length) {
    const { deletePublicImages } = await import("@/lib/supabaseStorage");
    await deletePublicImages(r.photoUrls);
  }
  revalidatePath("/admin/quarantine");
}

export async function resolveReport(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  await prisma.report.update({ where: { id }, data: { status: "resolved" } });
  revalidatePath("/admin/reports");
}

/** 신고 대상 콘텐츠를 숨김 처리하고 신고를 resolved 로 종료. */
export async function hideAndResolve(formData: FormData) {
  await ensureAdmin();
  const reportId = String(formData.get("reportId"));
  const targetType = String(formData.get("targetType"));
  const targetId = String(formData.get("targetId"));

  try {
    if (targetType === "store") {
      await prisma.store.update({ where: { id: targetId }, data: { status: "hidden" } });
    } else if (targetType === "sale") {
      await prisma.sale.update({ where: { id: targetId }, data: { status: "hidden" } });
      // 관리자 숨김 시 해당 제보 적립 포인트 회수
      await prisma.pointLog.deleteMany({ where: { refType: "sale", refId: targetId } });
    } else if (targetType === "product") {
      await prisma.product.update({ where: { id: targetId }, data: { hidden: true } });
      await prisma.pointLog.deleteMany({ where: { refType: "product", refId: targetId } });
    } else if (targetType === "review") {
      await prisma.review.update({ where: { id: targetId }, data: { hidden: true } });
      // 관리자 숨김 시 해당 리뷰 적립 포인트 회수
      await prisma.pointLog.deleteMany({ where: { refType: "review", refId: targetId } });
    }
  } catch {
    // 대상이 이미 삭제/숨김 → 무시하고 신고만 종료
  }
  await prisma.report.update({ where: { id: reportId }, data: { status: "resolved" } });
  revalidatePath("/admin/reports");
}

/** 사장님 인증 승인: merchant 권한 부여 + 가게 소유권 지정 (Phase 7a). */
export async function approveMerchant(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const v = await prisma.merchantVerification.findUnique({ where: { id } });
  if (!v || v.status !== "pending") return;

  await prisma.$transaction([
    prisma.user.update({ where: { id: v.userId }, data: { role: "merchant" } }),
    prisma.store.update({
      where: { id: v.storeId },
      data: { ownerId: v.userId, source: "merchant", verified: true },
    }),
    prisma.merchantVerification.update({
      where: { id },
      data: { status: "approved", reviewedAt: new Date() },
    }),
  ]);
  revalidatePath("/admin/merchants");
}

export async function rejectMerchant(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  await prisma.merchantVerification.update({
    where: { id },
    data: { status: "rejected", reviewedAt: new Date() },
  });
  revalidatePath("/admin/merchants");
}

/** 신고 대상 콘텐츠의 작성자 id 조회. */
async function authorOf(targetType: string, targetId: string): Promise<string | null> {
  if (targetType === "sale") {
    return (await prisma.sale.findUnique({ where: { id: targetId }, select: { createdById: true } }))?.createdById ?? null;
  }
  if (targetType === "product") {
    return (await prisma.product.findUnique({ where: { id: targetId }, select: { createdById: true } }))?.createdById ?? null;
  }
  if (targetType === "review") {
    return (await prisma.review.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId ?? null;
  }
  if (targetType === "store") {
    return (await prisma.store.findUnique({ where: { id: targetId }, select: { createdById: true } }))?.createdById ?? null;
  }
  return null;
}

/** 신고 콘텐츠 작성자 계정 정지 + 신고 종료 (Phase 7b-2). 관리자 계정은 정지하지 않음. */
export async function banAuthor(formData: FormData) {
  await ensureAdmin();
  const reportId = String(formData.get("reportId"));
  const targetType = String(formData.get("targetType"));
  const targetId = String(formData.get("targetId"));
  const authorId = await authorOf(targetType, targetId);
  if (authorId) {
    const u = await prisma.user.findUnique({ where: { id: authorId }, select: { role: true } });
    if (u && u.role !== "admin") {
      await prisma.user.update({ where: { id: authorId }, data: { status: "banned" } });
    }
  }
  await prisma.report.update({ where: { id: reportId }, data: { status: "resolved" } });
  revalidatePath("/admin/reports");
}

/** 계정 정지 해제 (Phase 7b-2). */
export async function unbanUser(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  await prisma.user.update({ where: { id }, data: { status: "active" } });
  revalidatePath("/admin/users");
}

/** 회원 관리(계정잠금) — 관리자 계정은 잠그지 않음. 회원 정보 화면용. */
export async function lockUser(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const u = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (u && u.role !== "admin") {
    await prisma.user.update({ where: { id }, data: { status: "banned" } });
  }
  revalidatePath("/admin/members");
}

/** 계정잠금 해제. 회원 정보 화면용. */
export async function unlockUser(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  await prisma.user.update({ where: { id }, data: { status: "active" } });
  revalidatePath("/admin/members");
}

/**
 * 강제 탈퇴(관리자) — 본인 탈퇴(deleteAccount)와 동일하게 콘텐츠는 sentinel 로 익명화하고
 * User 행을 삭제(PII 파기)한다. 관리자 계정은 보호. 탈퇴 통계 로그 기록.
 */
export async function forceDeleteUser(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, provider: true } });
  if (!target || target.role === "admin") {
    return; // 관리자 계정은 강제 탈퇴 불가
  }

  const ghost =
    (await prisma.user.findFirst({ where: { providerId: "deleted-user" } })) ??
    (await prisma.user.create({
      data: { provider: "kakao", providerId: "deleted-user", nickname: "탈퇴한 사용자" },
    }));

  await prisma.withdrawalLog.create({ data: { provider: target.provider ?? null } });

  await prisma.$transaction([
    prisma.store.updateMany({ where: { createdById: id }, data: { createdById: ghost.id } }),
    prisma.product.updateMany({ where: { createdById: id }, data: { createdById: ghost.id } }),
    prisma.sale.updateMany({ where: { createdById: id }, data: { createdById: ghost.id } }),
  ]);
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/members");
}

/** 기프티콘 교환 발송 완료 처리. */
export async function markRedemptionSent(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  await prisma.redemption.update({
    where: { id },
    data: { status: "sent", sentAt: new Date() },
  });
  revalidatePath("/admin/redemptions");
}

/** 기프티콘 교환 취소 + 포인트 환원(음수 차감 로그 삭제). */
export async function cancelRedemption(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const r = await prisma.redemption.findUnique({ where: { id } });
  if (!r || r.status === "canceled") return;
  await prisma.$transaction([
    // 교환 시 생성한 음수 PointLog 삭제 → 잔액 환원
    prisma.pointLog.deleteMany({ where: { refType: "redemption", refId: id } }),
    prisma.redemption.update({ where: { id }, data: { status: "canceled" } }),
  ]);
  revalidatePath("/admin/redemptions");
}

/** M5: 제휴사 정산 완료 처리(원가 실지출 확정). 발송 완료 건만 의미. */
export async function settleRedemption(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  await prisma.redemption.update({ where: { id }, data: { settledAt: new Date() } });
  revalidatePath("/admin/settlements");
  revalidatePath("/admin/redemptions");
}

/** M5: 정산 완료 취소(미정산으로 되돌림). */
export async function unsettleRedemption(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  await prisma.redemption.update({ where: { id }, data: { settledAt: null } });
  revalidatePath("/admin/settlements");
  revalidatePath("/admin/redemptions");
}

/** 고객센터 문의 답변 등록 → 상태 answered. */
export async function answerInquiry(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) return;
  await prisma.inquiry.update({
    where: { id },
    data: { answer, status: "answered", answeredAt: new Date() },
  });
  revalidatePath("/admin/inquiries");
}

/** M1-B: 영업 리드 아웃리치 상태/메모 갱신. */
export async function setLeadStatus(formData: FormData) {
  const session = await getAdminSession();
  if (!session) throw new Error("forbidden");
  const storeId = String(formData.get("storeId"));
  const status = String(formData.get("status"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const allowed = ["new", "contacted", "proposed", "converted", "dropped"];
  if (!storeId || !allowed.includes(status)) return;
  await prisma.leadOutreach.upsert({
    where: { storeId },
    update: { status: status as Prisma.LeadOutreachUpdateInput["status"], note: note || null, updatedBy: session.user?.id ?? null },
    create: { storeId, status: status as Prisma.LeadOutreachCreateInput["status"], note: note || null, updatedBy: session.user?.id ?? null },
  });
  revalidatePath("/admin/leads");
}

/**
 * M1-A: 스폰서 14일 무료체험 시작. 인증 가게만, 진행 중 스폰서가 없을 때만.
 * 결제(PG)는 M2 — 체험은 과금 없이 즉시 노출(마퀴 고정 + 금색 핀)된다.
 */
export async function startSponsorTrial(formData: FormData) {
  await ensureAdmin();
  const storeId = String(formData.get("storeId"));
  const region = String(formData.get("region") ?? "").trim().slice(0, 40) || "미지정";
  if (!storeId) return;

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { verified: true } });
  if (!store || !store.verified) return; // 미인증 가게는 광고 노출 대상이 아님

  // 이미 노출 중인 스폰서가 있으면 중복 생성 금지
  const existing = await prisma.sponsorship.findFirst({
    where: { ...liveSponsorFilter(), storeId },
    select: { id: true },
  });
  if (existing) return;

  const settings = await getSiteSettings();
  const now = new Date();
  const ends = trialEndDate(now, settings.trialDays);
  await prisma.sponsorship.create({
    data: {
      storeId,
      region,
      status: "trial",
      priceKrw: settings.priceSponsor,
      trialEndsAt: ends,
      startsAt: now,
      endsAt: ends, // 체험 종료 = 노출 보장 종료(결제 확인 시 연장)
    },
  });
  revalidatePath("/admin/sponsors");
}

/** M1-A: 입금/결제 확인 → 유료 활성 + 30일 연장(기존 만료일 기준 누적). */
export async function confirmSponsorPayment(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const s = await prisma.sponsorship.findUnique({ where: { id }, select: { endsAt: true } });
  if (!s) return;
  const { paidPeriodDays } = await getSiteSettings();
  await prisma.sponsorship.update({
    where: { id },
    data: { status: "active", endsAt: extendPaidDate(s.endsAt, new Date(), paidPeriodDays) },
  });
  revalidatePath("/admin/sponsors");
}

/** M1-A: 유료 1주기 연장(기간은 관리자 설정). */
export async function extendSponsor(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const s = await prisma.sponsorship.findUnique({ where: { id }, select: { endsAt: true } });
  if (!s) return;
  const { paidPeriodDays } = await getSiteSettings();
  await prisma.sponsorship.update({
    where: { id },
    data: { status: "active", endsAt: extendPaidDate(s.endsAt, new Date(), paidPeriodDays) },
  });
  revalidatePath("/admin/sponsors");
}

/** M1-A: 스폰서 취소(즉시 노출 종료). M2: 자동결제 구독 발이면 구독도 함께 해지(다음 청구 중단). */
export async function cancelSponsor(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  const sp = await prisma.sponsorship.findUnique({
    where: { id },
    select: { subscriptionId: true },
  });
  const now = new Date();
  await prisma.sponsorship.update({
    where: { id },
    data: { status: "canceled", endsAt: now },
  });
  if (sp?.subscriptionId) {
    await prisma.subscription.update({
      where: { id: sp.subscriptionId },
      data: { status: "canceled", canceledAt: now },
    });
  }
  revalidatePath("/admin/sponsors");
}

export async function approveStore(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  await prisma.store.update({ where: { id }, data: { verified: true } });
  revalidatePath("/admin/stores");
}

export async function rejectStore(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id"));
  await prisma.store.update({ where: { id }, data: { status: "hidden" } });
  revalidatePath("/admin/stores");
}
