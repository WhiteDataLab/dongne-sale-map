"use client";

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
        "pointer-events-auto shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
        disabled
          ? "cursor-not-allowed border-gray-200 bg-white/70 text-gray-300"
          : active
            ? "border-blue-600 bg-blue-600 text-white shadow"
            : "border-gray-200 bg-white text-gray-700 shadow-sm",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
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

      <span className="mx-1 w-px shrink-0 self-stretch bg-gray-200" aria-hidden />

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
