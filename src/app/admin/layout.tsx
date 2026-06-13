import Link from "next/link";
import { getAdminSession } from "@/lib/admin";

/** 관리 네비 그룹(라벨 + 링크 묶음). */
function AdminGroup({ label, links }: { label: string; links: [string, string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-20 shrink-0 text-xs font-semibold text-gray-400">{label}</span>
      {links.map(([href, text]) => (
        <Link key={href} href={href} className="text-gray-600 hover:text-gray-900">
          {text}
        </Link>
      ))}
    </div>
  );
}

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
        <header className="mb-4 border-b border-gray-100 pb-3">
          <div className="mb-2 flex items-center justify-between">
            <Link href="/admin" className="font-bold">
              관리 콘솔
            </Link>
            <Link href="/" className="text-xs text-gray-400">
              ← 지도
            </Link>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <AdminGroup
              label="현황"
              links={[
                ["/admin/dashboard", "대시보드"],
                ["/admin/activity", "활동 분석"],
              ]}
            />
            <AdminGroup
              label="심사 큐"
              links={[
                ["/admin/reports", "신고 큐"],
                ["/admin/stores", "가게 인증"],
                ["/admin/merchants", "사장님 인증"],
              ]}
            />
            <AdminGroup
              label="회원"
              links={[
                ["/admin/members", "회원 정보"],
                ["/admin/users", "정지 계정"],
              ]}
            />
            <AdminGroup
              label="영업"
              links={[
                ["/admin/leads", "리드 추출"],
                ["/admin/sponsors", "스폰서 광고"],
              ]}
            />
            <AdminGroup
              label="포인트샵"
              links={[
                ["/admin/redemptions", "기프티콘 교환"],
                ["/admin/gifts", "기프티콘 상품"],
              ]}
            />
            <AdminGroup
              label="지원 · 콘텐츠"
              links={[
                ["/admin/inquiries", "고객센터"],
                ["/admin/notices", "공지 · 이벤트"],
              ]}
            />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
