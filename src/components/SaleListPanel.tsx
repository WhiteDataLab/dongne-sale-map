"use client";

import { useMemo, useState } from "react";
import { CATEGORY_META } from "@/lib/constants";
import { won } from "@/lib/format";
import type { StoreDTO } from "@/lib/types";
import { Countdown } from "./Countdown";

type SortKey = "soon" | "cheap" | "new";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "soon", label: "마감임박순" },
  { key: "cheap", label: "최저가순" },
  { key: "new", label: "최신순" },
];

/**
 * 현재 지도 영역의 세일 목록 패널 (에어비앤비/배민 포장식 지도↔목록).
 * 정렬: 마감임박순 / 최저가순 / 최신순. 항목 클릭 시 해당 가게 상세를 연다.
 */
export function SaleListPanel({
  stores,
  onSelect,
  onClose,
}: {
  stores: StoreDTO[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [sort, setSort] = useState<SortKey>("soon");

  const sorted = useMemo(() => {
    const sale = stores.filter((s) => s.hasActiveSale && s.verified);
    const arr = [...sale];
    const num = (v: number | null, fallback: number) => (v == null ? fallback : v);
    const time = (v: string | null, fallback: number) => (v ? new Date(v).getTime() : fallback);
    if (sort === "soon") arr.sort((a, b) => time(a.saleSoonestExpiry, Infinity) - time(b.saleSoonestExpiry, Infinity));
    else if (sort === "cheap") arr.sort((a, b) => num(a.saleMinPrice, Infinity) - num(b.saleMinPrice, Infinity));
    else arr.sort((a, b) => time(b.saleLatestCreated, 0) - time(a.saleLatestCreated, 0));
    return arr;
  }, [stores, sort]);

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex max-h-[62%] flex-col rounded-t-2xl bg-white shadow-2xl md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[360px] md:max-w-[88vw] md:rounded-t-none md:rounded-l-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 pb-2 pt-3">
        <h2 className="text-sm font-bold">
          🔥 세일 목록 <span className="text-gray-400">({sorted.length})</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="목록 닫기"
          className="rounded-full px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
        >
          지도 보기 ✕
        </button>
      </div>

      {/* 정렬 */}
      <div className="flex shrink-0 gap-1.5 px-4 py-2">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              sort === s.key
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {sorted.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            이 지역에 진행 중인 세일이 없어요.
            <br />
            지도를 움직여 다른 동네를 둘러보세요.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {sorted.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100"
                >
                  <span className="text-xl" aria-hidden>
                    {CATEGORY_META[s.category].icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-xs text-gray-400">{s.address}</p>
                    {s.saleSoonestExpiry && (
                      <p className="mt-0.5 text-xs">
                        <Countdown to={s.saleSoonestExpiry} />
                      </p>
                    )}
                  </div>
                  {s.saleMinPrice != null && (
                    <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-600">
                      {won(s.saleMinPrice)}~
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
