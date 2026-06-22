import { getAdminSession } from "@/lib/admin";
import {
  getMemberSegments,
  ROLE_META,
  MERCHANT_TIER_META,
  type MemberSegments,
} from "@/lib/memberSegments";

/** 회원 구성 — 권한(일반인/사장님/관리자) + 사장님 등급(무료/라이트/스폰서/프로) 시각화. */
export const dynamic = "force-dynamic";
export const metadata = { title: "회원 구성 — 관리" };

/** 도넛(파이) — 합계 대비 세그먼트 비율을 stroke 로. 중앙에 총계 표시. */
function Donut({
  segments,
  total,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  centerLabel: string;
}) {
  const r = 60;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label={centerLabel}>
      <g transform="rotate(-90 80 80)">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#EEF1F5" strokeWidth="18" />
        {total > 0 &&
          segments.map((s) => {
            const frac = s.value / total;
            const seg = frac * C;
            const el = (
              <circle
                key={s.label}
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="18"
                strokeDasharray={`${seg} ${C - seg}`}
                strokeDashoffset={-acc * C}
              />
            );
            acc += frac;
            return el;
          })}
      </g>
      <text x="80" y="74" textAnchor="middle" className="fill-ink text-[26px] font-extrabold">
        {total.toLocaleString("ko-KR")}
      </text>
      <text x="80" y="96" textAnchor="middle" className="fill-ink-3 text-[12px] font-medium">
        {centerLabel}
      </text>
    </svg>
  );
}

/** 가로 누적 막대(비율). */
function StackedBar({ segments, total }: { segments: { color: string; value: number }[]; total: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
      {total > 0 &&
        segments.map((s, i) =>
          s.value > 0 ? (
            <div key={i} style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} />
          ) : null,
        )}
    </div>
  );
}

function pct(v: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((v / total) * 100)}%`;
}

export default async function AdminSegmentsPage() {
  const session = await getAdminSession();
  if (!session) return null;

  let data: MemberSegments | null = null;
  try {
    data = await getMemberSegments();
  } catch {
    return <p className="py-10 text-center text-sm text-ink-3">회원 구성을 불러오지 못했어요 (DB 연결 확인).</p>;
  }

  const roleSegments = ROLE_META.map((m) => ({ label: m.label, value: data!.roles[m.key], color: m.color }));
  const tierSegments = MERCHANT_TIER_META.map((m) => ({
    label: m.label,
    value: data!.merchant.tiers[m.key],
    color: m.color,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">회원 구성</h2>
        <span className="text-xs text-ink-3">권한 · 사장님 등급 분포</span>
      </div>

      {/* 무료 오픈 모드 안내 */}
      {!data.monetization && (
        <div className="rounded-xl bg-brand-wash p-3 text-xs leading-relaxed text-brand-ink">
          🌱 현재 <b>무료 오픈 모드</b>예요. 유료 구독은 아직 받지 않으므로 라이트·스폰서·프로 구독은 0건이
          정상이에요. 인증 사장님은 <b>라이트 기능을 무료로</b> 쓰고 있어요. (유료 오픈 시 이 화면에 등급별
          분포가 채워집니다.)
        </div>
      )}

      {/* 권한 분포: 도넛 + 범례 */}
      <section className="rounded-2xl border border-line bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-ink">권한 분포</h3>
        <div className="flex items-center gap-5">
          <Donut segments={roleSegments} total={data.total} centerLabel="전체 회원" />
          <ul className="flex min-w-0 flex-1 flex-col gap-2">
            {ROLE_META.map((m) => {
              const v = data!.roles[m.key];
              return (
                <li key={m.key} className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: m.color }} />
                  <span className="text-sm font-medium text-ink-2">{m.label}</span>
                  <span className="ml-auto text-sm font-bold tabular-nums text-ink">
                    {v.toLocaleString("ko-KR")}명
                  </span>
                  <span className="w-10 text-right text-xs tabular-nums text-ink-3">
                    {pct(v, data!.total)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 사장님 등급(구독 기준) */}
      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-ink">사장님 등급 (구독 기준)</h3>
          <span className="text-xs text-ink-3">사장님 {data.merchant.total.toLocaleString("ko-KR")}명</span>
        </div>

        <StackedBar segments={tierSegments} total={data.merchant.total} />

        <ul className="mt-3 grid grid-cols-2 gap-2">
          {MERCHANT_TIER_META.map((m) => {
            const v = data!.merchant.tiers[m.key];
            return (
              <li key={m.key} className="rounded-xl border border-line p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: m.color }} />
                  <span className="text-sm font-bold text-ink">{m.label}</span>
                  <span className="ml-auto text-sm font-extrabold tabular-nums text-ink">
                    {v.toLocaleString("ko-KR")}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-ink-3">{m.note}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-3">
          · 라이트·프로는 기능 등급, 스폰서는 노출 부스트 구독이에요. · 현재 라이브 구독{" "}
          {data.liveSubscriptions.toLocaleString("ko-KR")}건 · 노출 중 스폰서 가게{" "}
          {data.liveSponsorStores.toLocaleString("ko-KR")}곳.
        </p>
      </section>

      {/* 사장님 인증 현황 */}
      <section className="rounded-2xl border border-line bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-ink">사장님 인증 현황</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "인증 사장님", emoji: "✅", n: data.merchant.verified, cls: "bg-verify-wash text-verify-ink", hint: "인증 가게 소유 · 무료모드 라이트 개방" },
            { label: "미인증", emoji: "⏳", n: data.merchant.unverifiedOnly, cls: "bg-amber-50 text-amber-700", hint: "가게는 있으나 인증 전" },
            { label: "가게 없음", emoji: "🚪", n: data.merchant.noStore, cls: "bg-surface-2 text-ink-3", hint: "사장님 권한 · 소유 가게 없음" },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl p-3 text-center ${c.cls}`}>
              <div className="text-lg">{c.emoji}</div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums">{c.n.toLocaleString("ko-KR")}</div>
              <div className="text-[11px] font-medium opacity-80">{c.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          · 무료 오픈 모드에선 <b>인증 사장님</b>이 라이트 기능(세일 알림·단골·리뷰 답글·공식 배지)을 무료로
          써요. 유료 오픈 시 이들이 구독 전환 타깃이에요.
        </p>
      </section>

      <p className="text-xs text-ink-3">
        · 권한은 User.role(일반인/사장님/관리자) 기준이에요. · 등급은 진행 중(체험·유료) 구독 기준이며,
        사장님별 최상위 플랜 1개로 집계해요. · 탈퇴·sentinel 계정은 제외돼요.
      </p>
    </div>
  );
}
