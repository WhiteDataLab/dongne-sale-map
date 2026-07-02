import { getAdminSession } from "@/lib/admin";
import { getLaunchFlags } from "@/lib/launchFlags";
import { toggleLaunchFlag } from "../actions";

/** 운영 모드(무료 오픈) — 사장님 유료·픽업 예약을 켜고 끄는 관리자 토글. */
export const dynamic = "force-dynamic";
export const metadata = { title: "운영 모드 — 관리" };

type Row = {
  key: "monetization" | "reservations" | "pointshop" | "classicMap";
  on: boolean;
  title: string;
  onDesc: string;
  offDesc: string;
  turnOnLabel?: string; // 기본 "켜기 (오픈)"
  turnOffLabel?: string; // 기본 "끄기 (숨기기)"
};

export default async function AdminLaunchPage() {
  const session = await getAdminSession();
  if (!session) return null;

  const flags = await getLaunchFlags();
  const rows: Row[] = [
    {
      key: "monetization",
      on: flags.monetization,
      title: "💳 사장님 유료 (구독·결제·CPA 광고)",
      onDesc:
        "요금제·토스 결제·CPA 광고·홍보 CTA·업셀이 노출됩니다. 사장님이 유료로 전환할 수 있어요.",
      offDesc:
        "유료 진입점이 전부 숨겨지고, 인증 사장님은 관계 기능(리뷰 답글·세일 알림·단골 식별·공식 배지)을 무료로 씁니다.",
    },
    {
      key: "reservations",
      on: flags.reservations,
      title: "🏃 픽업 예약 (떨이 선점)",
      onDesc: "소비자가 마감임박 세일을 앱에서 선점·픽업할 수 있고, 사장님은 예약을 받습니다.",
      offDesc: "예약 받기/하기 UI가 전부 숨겨집니다. (메뉴·세일·리뷰 등 나머지는 그대로)",
    },
    {
      key: "pointshop",
      on: flags.pointshop,
      title: "🎁 포인트샵 교환 (기프티콘)",
      onDesc: "모은 포인트로 기프티콘을 교환할 수 있어요. 교환 시 실제 원가가 발생합니다.",
      offDesc:
        "적립은 계속되고 교환만 잠깁니다. /shop 은 '곧 교환 오픈 · 지금 모아두세요' 티저(상품 노출 + 교환 잠금)로 보여요.",
    },
    {
      key: "classicMap",
      on: flags.classicMap,
      title: "🗺️ 이전 지도 UI 롤백",
      onDesc:
        "이전 지도 UI(카테고리 칩 필터 · 가게 등록 버튼만)로 되돌린 상태예요. 콜드스타트 개편(지금 세일중 토글·라이브 카운터·세일 히트맵·원탭 제보)이 숨겨져요.",
      offDesc:
        "새 콜드스타트 지도 UI가 켜져 있어요(기본). 문제가 생기면 켜서 이전 UI로 즉시 롤백할 수 있어요(재배포 불필요).",
      turnOnLabel: "이전 UI로 롤백하기",
      turnOffLabel: "새 UI로 다시 켜기",
    },
  ];

  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="text-lg font-extrabold tracking-tight text-ink">운영 모드</h1>
      <p className="mt-1 text-sm text-ink-3">
        출시 초기 무료 집중 전략용. 끄면 해당 기능이 <b>숨겨질 뿐</b> 삭제되지 않으며, 언제든 다시
        켤 수 있어요. 기본값은 둘 다 꺼짐(무료 모드).
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.key} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-ink">{r.title}</p>
                <p className="mt-1 text-sm text-ink-3">{r.on ? r.onDesc : r.offDesc}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${
                  r.on ? "bg-verify-wash text-verify-ink" : "bg-surface-2 text-ink-3"
                }`}
              >
                {r.on ? "켜짐" : "꺼짐(숨김)"}
              </span>
            </div>
            <form action={toggleLaunchFlag} className="mt-3">
              <input type="hidden" name="key" value={r.key} />
              <input type="hidden" name="on" value={r.on ? "0" : "1"} />
              <button
                type="submit"
                className={`min-h-[48px] w-full rounded-btn px-4 text-sm font-bold text-white ${
                  r.on ? "bg-ink" : "bg-brand"
                }`}
              >
                {r.on ? (r.turnOffLabel ?? "끄기 (숨기기)") : (r.turnOnLabel ?? "켜기 (오픈)")}
              </button>
            </form>
          </div>
        ))}
      </div>

      <p className="mt-5 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        ※ 토글은 즉시 반영됩니다(재배포 불필요). 켜기 전 토스 결제키·운영 정책(예약 시 전자상거래법
        등)이 준비됐는지 확인하세요.
      </p>
    </main>
  );
}
