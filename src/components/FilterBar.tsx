"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/constants";

/**
 * 상세조회 필터 (스펙 Phase 1).
 * - 카테고리(전체/야채/정육/과일): 이번 Phase에서 서버 필터 동작.
 * - 세일중: Sale 모델 기준 동작.
 * - 영업중/영업종료: 영업시간 자동판정 → TODO(phase-2) 에서 활성화.
 * - 평점: 리뷰 데이터 기반 → TODO(phase-3) 에서 활성화.
 *   (지금 미리 구현하면 황금률 "한 번에 한 Phase"에 위배되므로 비활성 칩으로만 노출)
 */
export type Filters = {
  category: Category | "all";
  onlySale: boolean;
  onlyOpen: boolean; // 영업중만
  onlySoon: boolean; // 마감임박(1시간 내)만
};

function Chip({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "pointer-events-auto shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition",
        disabled
          ? "border-line bg-white/70 text-ink-4 cursor-not-allowed"
          : active
            ? "border-brand bg-brand text-white shadow"
            : "border-line bg-white text-ink-2 shadow-sm",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  filters,
  onChange,
  hero = false,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  /**
   * 콜드스타트 히어로 모드(THEME_MAP_BENCHMARK_PM_BRIEF P0-4, 거지맵 패턴):
   * '지금 세일중' 조건 토글 하나를 가장 크게, 나머지 필터(업종·영업중)는 '필터'로 접는다.
   * false 면 이전 칩 병렬 레이아웃(롤백용, /admin/launch '이전 지도 UI').
   */
  hero?: boolean;
}) {
  const [more, setMore] = useState(false);

  if (hero) {
    const moreActive = filters.category !== "all" || filters.onlyOpen;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-stretch gap-2">
          {/* 히어로: 조건(상황)이 탐색의 출발점 — "지금 세일중" 단 하나를 크게 */}
          <button
            type="button"
            onClick={() => onChange({ ...filters, onlySale: !filters.onlySale })}
            aria-pressed={filters.onlySale}
            style={filters.onlySale ? { background: "var(--deal-grad)" } : undefined}
            className={[
              "pointer-events-auto min-h-[48px] flex-1 rounded-full px-4 text-base font-extrabold shadow transition",
              filters.onlySale
                ? "text-white"
                : "border border-deal/50 bg-white text-deal-ink",
            ].join(" ")}
          >
            🔥 지금 세일중
          </button>
          <Chip
            active={filters.onlySoon}
            onClick={() => onChange({ ...filters, onlySoon: !filters.onlySoon })}
            title="1시간 내 마감되는 세일"
          >
            ⏰ 마감임박
          </Chip>
          <Chip active={more || moreActive} onClick={() => setMore((v) => !v)}>
            필터 {more ? "▲" : "▼"}
          </Chip>
        </div>
        {more && (
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <Chip
              active={filters.category === "all"}
              onClick={() => onChange({ ...filters, category: "all" })}
            >
              전체
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                active={filters.category === c}
                onClick={() => onChange({ ...filters, category: c })}
              >
                {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden />
            <Chip
              active={filters.onlyOpen}
              onClick={() => onChange({ ...filters, onlyOpen: !filters.onlyOpen })}
            >
              🟢 영업중
            </Chip>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <Chip
        active={filters.category === "all"}
        onClick={() => onChange({ ...filters, category: "all" })}
      >
        전체
      </Chip>
      {CATEGORIES.map((c) => (
        <Chip
          key={c}
          active={filters.category === c}
          onClick={() => onChange({ ...filters, category: c })}
        >
          {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
        </Chip>
      ))}

      <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden />

      <Chip
        active={filters.onlySale}
        onClick={() => onChange({ ...filters, onlySale: !filters.onlySale })}
      >
        🔥 세일중
      </Chip>
      <Chip
        active={filters.onlySoon}
        onClick={() => onChange({ ...filters, onlySoon: !filters.onlySoon })}
        title="1시간 내 마감되는 세일"
      >
        ⏰ 마감임박
      </Chip>
      <Chip
        active={filters.onlyOpen}
        onClick={() => onChange({ ...filters, onlyOpen: !filters.onlyOpen })}
      >
        🟢 영업중
      </Chip>
    </div>
  );
}
