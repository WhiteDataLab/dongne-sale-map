import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminHome() {
  let openReports = 0;
  let pendingStores = 0;
  try {
    [openReports, pendingStores] = await Promise.all([
      prisma.report.count({ where: { status: "open" } }),
      prisma.store.count({ where: { verified: false, status: "active" } }),
    ]);
  } catch {
    // DB 미연결 시 0
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/admin/reports"
        className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
      >
        <span className="font-medium">신고 큐</span>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-sm text-red-600">
          처리 대기 {openReports}
        </span>
      </Link>
      <Link
        href="/admin/stores"
        className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
      >
        <span className="font-medium">가게 인증</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-700">
          승인 대기 {pendingStores}
        </span>
      </Link>
    </div>
  );
}
