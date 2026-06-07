import Link from "next/link";

export const metadata = { title: "사이트맵 — 동네 세일 지도" };

const GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "탐색",
    links: [
      { href: "/", label: "지도(홈)" },
      { href: "/favorites", label: "즐겨찾기" },
      { href: "/news", label: "동네 소식" },
    ],
  },
  {
    title: "기여",
    links: [{ href: "/?register=1", label: "가게 등록" }],
  },
  {
    title: "혜택",
    links: [
      { href: "/checkin", label: "출석체크" },
      { href: "/shop", label: "포인트샵" },
      { href: "/invite", label: "친구 초대" },
      { href: "/notices", label: "공지 · 이벤트" },
    ],
  },
  {
    title: "내 정보",
    links: [
      { href: "/account", label: "마이페이지" },
      { href: "/notifications", label: "알림함" },
      { href: "/settings", label: "설정" },
    ],
  },
  {
    title: "고객지원",
    links: [
      { href: "/support", label: "고객센터" },
      { href: "/faq", label: "자주 묻는 질문" },
    ],
  },
  {
    title: "서비스 · 정책",
    links: [
      { href: "/about", label: "서비스 소개" },
      { href: "/company", label: "서비스 운영 정보" },
      { href: "/terms", label: "이용약관" },
      { href: "/privacy", label: "개인정보처리방침" },
      { href: "/location-terms", label: "위치기반서비스 이용약관" },
      { href: "/policy", label: "운영정책 · 커뮤니티 가이드" },
      { href: "/refund", label: "포인트 · 기프티콘 교환/환불 정책" },
    ],
  },
];

/** 사이트맵 (P2). 전체 페이지 한눈에. */
export default function SitemapPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-5 p-5">
        <Link href="/" className="text-sm text-gray-400">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">사이트맵</h1>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h2 className="mb-1.5 text-sm font-semibold text-gray-700">{g.title}</h2>
              <ul className="flex flex-col gap-1">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-blue-600 hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
