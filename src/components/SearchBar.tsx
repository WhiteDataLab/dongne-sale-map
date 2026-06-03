"use client";

import { useState } from "react";

/**
 * 검색창 1개 (스펙 Phase 1).
 * 제출 시 부모(MapExplorer)가 지오코딩 → map.setCenter 한다.
 * GPS/현재위치 미사용 — 검색 이동만.
 */
export function SearchBar({
  onSearch,
  pending,
}: {
  onSearch: (q: string) => void;
  pending?: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) onSearch(q);
      }}
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-md"
    >
      <span aria-hidden className="text-gray-400">
        🔍
      </span>
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="동네·아파트·지번으로 검색 (예: 이문동)"
        className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        aria-label="장소 검색"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 text-sm font-medium text-blue-600 disabled:text-gray-300"
      >
        {pending ? "검색중" : "이동"}
      </button>
    </form>
  );
}
