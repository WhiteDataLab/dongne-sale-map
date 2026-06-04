"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";

/** 모든 관리 액션은 호출 시 관리자 권한을 재확인한다(폼에서 직접 호출될 수 있으므로). */
async function ensureAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("forbidden");
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
    } else if (targetType === "review") {
      await prisma.review.update({ where: { id: targetId }, data: { hidden: true } });
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
