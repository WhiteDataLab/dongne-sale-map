import Link from "next/link";

export const metadata = { title: "서비스 운영 정보 — 동네 세일 지도" };

/**
 * 회사/운영 정보 (P1). 포인트→기프티콘 교환 운영 주체·연락처 표기(전자상거래 정보 제공).
 * TODO(out-of-scope): 정식 사업자 등록 후 상호/대표/사업자등록번호/통신판매업신고번호/주소를 채운다.
 */
export default function CompanyPage() {
  const rows: { label: string; value: string }[] = [
    { label: "서비스명", value: "동네 세일 지도" },
    { label: "운영 주체", value: "준비 중 (정식 사업자 등록 후 표기)" },
    { label: "대표자", value: "준비 중" },
    { label: "사업자등록번호", value: "준비 중" },
    { label: "통신판매업신고번호", value: "준비 중" },
    { label: "주소", value: "서울특별시 동대문구 (상세 준비 중)" },
    { label: "고객센터", value: "앱 내 ‘고객센터’ 1:1 문의" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl space-y-4 p-5 text-sm leading-relaxed text-gray-700">
        <Link href="/" className="text-gray-400">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">서비스 운영 정보</h1>
        <p className="text-xs text-gray-400">
          포인트·기프티콘 교환 등 거래 관련 정보 제공을 위한 운영 주체 안내예요. (정식 운영 전
          일부 항목은 준비 중)
        </p>

        <dl className="overflow-hidden rounded-xl border border-gray-200">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`flex gap-3 px-4 py-3 ${i % 2 ? "bg-gray-50" : "bg-white"}`}
            >
              <dt className="w-32 shrink-0 text-gray-400">{r.label}</dt>
              <dd className="min-w-0 flex-1">{r.value}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-wrap gap-x-3 gap-y-1 pt-2">
          <Link href="/about" className="text-blue-600">서비스 소개</Link>
          <Link href="/terms" className="text-blue-600">이용약관</Link>
          <Link href="/privacy" className="text-blue-600">개인정보처리방침</Link>
          <Link href="/refund" className="text-blue-600">교환/환불 정책</Link>
        </section>
      </article>
    </div>
  );
}
