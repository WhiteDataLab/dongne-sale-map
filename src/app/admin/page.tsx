import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { IntroVideoUploader } from "@/components/IntroVideoUploader";

export default async function AdminHome() {
  let openReports = 0;
  let pendingStores = 0;
  let pendingMerchants = 0;
  let pendingRedemptions = 0;
  let openInquiries = 0;
  let introVideo: string | null = null;
  try {
    const [r, s, m, rd, iq, cfg] = await Promise.all([
      prisma.report.count({ where: { status: "open" } }),
      prisma.store.count({ where: { verified: false, status: "active" } }),
      prisma.merchantVerification.count({ where: { status: "pending" } }),
      prisma.redemption.count({ where: { status: "requested" } }),
      prisma.inquiry.count({ where: { status: "open" } }),
      prisma.siteConfig.findUnique({ where: { key: "intro_video_url" } }),
    ]);
    openReports = r;
    pendingStores = s;
    pendingMerchants = m;
    pendingRedemptions = rd;
    openInquiries = iq;
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
        href="/admin/members"
        className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
      >
        <span className="font-medium">👥 회원 정보</span>
        <span className="text-sm text-gray-400">가입·포인트·계정잠금/탈퇴 →</span>
      </Link>
      <Link
        href="/admin/activity"
        className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
      >
        <span className="font-medium">🔥 활동 분석</span>
        <span className="text-sm text-gray-400">활발한 회원·가게등록·리뷰 랭킹 →</span>
      </Link>
      <Link
        href="/admin/redemptions"
        className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
      >
        <span className="font-medium">🎁 기프티콘 교환</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-700">
          발송 대기 {pendingRedemptions}
        </span>
      </Link>
      <Link
        href="/admin/gifts"
        className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
      >
        <span className="font-medium">🏷️ 기프티콘 상품</span>
        <span className="text-sm text-gray-400">추가·수정·삭제·이미지 →</span>
      </Link>
      <Link
        href="/admin/inquiries"
        className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
      >
        <span className="font-medium">🎧 고객센터</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-700">
          미답변 {openInquiries}
        </span>
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
