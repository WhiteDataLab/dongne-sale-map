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
    } else if (targetType === "review") {
      await prisma.review.update({ where: { id: targetId }, data: { hidden: true } });
    }
  } catch {
    // 대상이 이미 삭제/숨김 → 무시하고 신고만 종료
  }
  await prisma.report.update({ where: { id: reportId }, data: { status: "resolved" } });
  revalidatePath("/admin/reports");
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
