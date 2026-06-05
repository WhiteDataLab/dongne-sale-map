import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { IntroVideoUploader } from "@/components/IntroVideoUploader";

export default async function AdminHome() {
  let openReports = 0;
  let pendingStores = 0;
  let pendingMerchants = 0;
  let introVideo: string | null = null;
  try {
    const [r, s, m, cfg] = await Promise.all([
      prisma.report.count({ where: { status: "open" } }),
      prisma.store.count({ where: { verified: false, status: "active" } }),
      prisma.merchantVerification.count({ where: { status: "pending" } }),
      prisma.siteConfig.findUnique({ where: { key: "intro_video_url" } }),
    ]);
    openReports = r;
    pendingStores = s;
    pendingMerchants = m;
    introVideo = cfg?.value ?? null;
  } catch {
    // DB 미연결 시 0
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/admin/dashboard"
        className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
      >
        <span className="font-medium">📊 대시보드</span>
        <span className="text-sm text-gray-400">오늘 가입·등록·리뷰 현황 →</span>
      </Link>
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
      <Link
        href="/admin/merchants"
        className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
      >
        <span className="font-medium">사장님 인증</span>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-sm text-blue-700">
          승인 대기 {pendingMerchants}
        </span>
      </Link>

      <IntroVideoUploader current={introVideo} />
    </div>
  );
}
