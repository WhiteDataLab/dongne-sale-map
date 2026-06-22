import { getAdminSession } from "@/lib/admin";
import { getPointConfig, POINT_CONFIG_META, POINT_DEFAULTS } from "@/lib/pointConfig";
import { savePointConfig } from "../actions";

/** 적립 포인트 설정 — 리뷰·제보·메뉴·추천·출석 적립액을 관리자가 자유롭게 조정. */
export const dynamic = "force-dynamic";
export const metadata = { title: "적립 포인트 설정 — 관리" };

export default async function AdminPointsPage() {
  const session = await getAdminSession();
  if (!session) return null;

  const cfg = await getPointConfig();

  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="text-lg font-extrabold tracking-tight text-ink">적립 포인트 설정</h1>
      <p className="mt-1 text-sm text-ink-3">
        활동별 적립 포인트(1P = 1원 상당)를 조정해요. 저장하면 <b>즉시 반영</b>되고(재배포 불필요),
        이후 적립부터 새 값이 적용됩니다. 비워두거나 0보다 작으면 기존 값이 유지돼요.
      </p>

      <form action={savePointConfig} className="mt-5 flex flex-col gap-3">
        {POINT_CONFIG_META.map((m) => (
          <div key={m.key} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <label htmlFor={`pt-${m.key}`} className="text-base font-bold text-ink">
                  {m.label}
                </label>
                <p className="mt-0.5 text-sm text-ink-3">{m.desc}</p>
                <p className="mt-0.5 text-xs text-ink-3">기본값 {POINT_DEFAULTS[m.key]}P</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <input
                  id={`pt-${m.key}`}
                  name={m.key}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={cfg[m.key]}
                  className="w-24 rounded-xl border border-line bg-surface-2 px-3 py-2 text-right text-base font-bold text-ink"
                />
                <span className="text-sm font-bold text-ink-3">P</span>
              </div>
            </div>
          </div>
        ))}

        <button
          type="submit"
          className="min-h-[48px] w-full rounded-btn bg-brand px-4 text-sm font-bold text-white"
        >
          저장하기
        </button>
      </form>

      <p className="mt-5 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        ※ 적립은 모두 PointLog(잔액 = 적립 합계)로 쌓여요. 이미 적립된 내역은 바뀌지 않고, 변경
        이후의 새 적립부터 적용됩니다. 출석은 매일/연속 7일/연속 30일 보너스가 각각 합산돼요.
      </p>
    </main>
  );
}
