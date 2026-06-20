import Link from "next/link";
import { auth } from "@/auth";

export const metadata = { title: "설정 — 동네 세일 지도" };

type Row = { href: string; label: string; desc?: string };

/** 설정 허브 (P2). 계정·알림·정책 진입점을 한곳에. */
export default async function SettingsPage() {
  const session = await auth();

  const account: Row[] = session?.user
    ? [
        { href: "/account", label: "프로필 · 닉네임", desc: "닉네임/사진 변경" },
        { href: "/account#contact", label: "수령 연락처", desc: "기프티콘 받을 연락처(SMS 인증)" },
        { href: "/notifications", label: "알림", desc: "공지·문의·교환 알림 보기" },
        { href: "/account", label: "회원 탈퇴", desc: "계정·데이터 삭제" },
      ]
    : [{ href: "/login", label: "로그인 / 회원가입", desc: "시작하려면 로그인하세요" }];

  const policy: Row[] = [
    { href: "/terms", label: "이용약관" },
    { href: "/privacy", label: "개인정보처리방침" },
    { href: "/location-terms", label: "위치기반서비스 이용약관" },
    { href: "/policy", label: "운영정책 · 커뮤니티 가이드" },
    { href: "/refund", label: "포인트 · 기프티콘 교환/환불 정책" },
    { href: "/company", label: "서비스 운영 정보" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg space-y-5 p-5">
        <Link href="/" className="text-sm text-ink-3">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-ink">설정</h1>

        <Section title="계정" rows={account} />
        <Section title="약관 · 정책" rows={policy} />

        <p className="text-center text-xs text-ink-3">
          푸시 알림은 현재 제공되지 않아요. 알림은 앱 내 ‘알림’에서 확인할 수 있어요.
        </p>
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink-2">{title}</h2>
      <ul className="overflow-hidden rounded-xl border border-line">
        {rows.map((r, i) => (
          <li key={`${r.href}-${r.label}`} className={i > 0 ? "border-t border-line-2" : ""}>
            <Link href={r.href} className="flex items-center justify-between gap-3 p-3.5 hover:bg-surface-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{r.label}</p>
                {r.desc && <p className="truncate text-xs text-ink-3">{r.desc}</p>}
              </div>
              <span className="shrink-0 text-ink-4">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
