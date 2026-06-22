import {
  getSiteSettings,
  SETTINGS_META,
  SETTINGS_DEFAULTS,
  GROUP_LABEL,
  type SettingsGroup,
} from "@/lib/siteSettings";
import { saveSiteSettings } from "@/app/admin/actions";

/**
 * 관리자 사이트 설정 — 그룹(ops/pricing/params) 단위 숫자 조정 폼(서버 컴포넌트).
 * 적립 포인트(/admin/points)와 동일한 패턴. 저장 시 즉시 반영(재배포 불필요).
 */
export async function SettingsGroupForm({
  group,
  intro,
}: {
  group: SettingsGroup;
  intro: string;
}) {
  const settings = await getSiteSettings();
  const fields = SETTINGS_META.filter((m) => m.group === group);

  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="text-lg font-extrabold tracking-tight text-ink">{GROUP_LABEL[group]}</h1>
      <p className="mt-1 text-sm text-ink-3">{intro}</p>

      <form action={saveSiteSettings} className="mt-5 flex flex-col gap-3">
        <input type="hidden" name="__group" value={group} />
        {fields.map((m) => (
          <div key={m.key} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <label htmlFor={`set-${m.key}`} className="text-base font-bold text-ink">
                  {m.label}
                </label>
                <p className="mt-0.5 text-sm text-ink-3">{m.desc}</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  기본값 {SETTINGS_DEFAULTS[m.key].toLocaleString()}
                  {m.unit}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <input
                  id={`set-${m.key}`}
                  name={m.key}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={settings[m.key]}
                  className="w-28 rounded-xl border border-line bg-surface-2 px-3 py-2 text-right text-base font-bold text-ink"
                />
                <span className="w-6 text-sm font-bold text-ink-3">{m.unit}</span>
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
        ※ 저장하면 즉시 반영됩니다(재배포 불필요). 비우거나 0보다 작으면 기존 값이 유지돼요. 변경
        이후의 동작부터 새 값이 적용됩니다.
      </p>
    </main>
  );
}
