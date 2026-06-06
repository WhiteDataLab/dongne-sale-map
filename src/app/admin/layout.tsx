import Link from "next/link";
import { getAdminSession } from "@/lib/admin";

/** 관리 화면 가드 + 네비 (스펙 Phase 4: 최소 관리 화면). role=admin 만 접근. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-gray-500">
        <p className="mt-10">관리자 권한이 필요해요.</p>
        <p className="mt-1 text-xs text-gray-400">
          (해당 계정의 User.role 을 admin 으로 변경 후 다시 로그인)
        </p>
        <Link href="/" className="mt-4 inline-block text-blue-600">
          ← 지도로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl p-4">
        <header className="mb-4 flex items-center gap-4 border-b border-gray-100 pb-3 text-sm">
          <span className="font-bold">관리</span>
          <Link href="/admin/dashboard" className="text-gray-600 hover:text-gray-900">
            대시보드
          </Link>
          <Link href="/admin/reports" className="text-gray-600 hover:text-gray-900">
            신고 큐
          </Link>
          <Link href="/admin/stores" className="text-gray-600 hover:text-gray-900">
            가게 인증
          </Link>
          <Link href="/admin/merchants" className="text-gray-600 hover:text-gray-900">
            사장님 인증
          </Link>
          <Link href="/admin/members" className="text-gray-600 hover:text-gray-900">
            회원 정보
          </Link>
          <Link href="/admin/activity" className="text-gray-600 hover:text-gray-900">
            활동 분석
          </Link>
          <Link href="/admin/redemptions" className="text-gray-600 hover:text-gray-900">
            기프티콘 교환
          </Link>
          <Link href="/admin/users" className="text-gray-600 hover:text-gray-900">
            정지 계정
          </Link>
          <Link href="/" className="ml-auto text-gray-400">
            ← 지도
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
