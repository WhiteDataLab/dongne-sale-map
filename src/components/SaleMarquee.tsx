"use client";

import { won } from "@/lib/format";
import type { FeedSale } from "@/lib/types";

/**
 * 지도 상단 광고판: 현 지역 최신 세일을 가로로 흘려보낸다(마퀴).
 * 데이터가 적어도 자연스럽게 보이도록 트랙을 2번 반복해 무한 루프.
 */
const MAX = 10; // 최대 10개까지만 노출(최신순)
const MIN_PER_HALF = 8; // 한 그룹이 화면을 채우도록 최소 항목 수

export function SaleMarquee({
  sales,
  onSelect,
}: {
  sales: FeedSale[];
  onSelect: (storeId: string) => void;
}) {
  if (sales.length === 0) return null;

  // 최신 등록순 10개 (API가 createdAt desc 로 내려줌)
  const base = sales.slice(0, MAX);
  // 항목이 적어도(예: 1개) 끊김 없이 무한으로 보이도록 한 그룹을 충분히 반복해 채운다.
  const repeat = Math.max(1, Math.ceil(MIN_PER_HALF / base.length));
  const half = Array.from({ length: repeat }, () => base).flat();
  // 두 그룹을 이어 붙여 translateX(-50%) 로 매끄럽게 루프
  const items = [...half, ...half];
  // 항목 수에 비례해 속도 일정하게(항목당 ~3초)
  const durationSec = Math.max(12, half.length * 3);

  return (
    <div className="marquee pointer-events-auto overflow-hidden rounded-full bg-black/75 py-1.5 text-white shadow-lg backdrop-blur-sm">
      <div className="marquee-track" style={{ animationDuration: `${durationSec}s` }}>
        {items.map((s, i) => (
          <button
            key={`${s.id}-${i}`}
            type="button"
            onClick={() => onSelect(s.storeId)}
            className="mx-3 inline-flex items-center gap-1.5 text-xs"
            aria-label={`${s.storeName} 세일 보기`}
          >
            {s.sponsored ? (
              <span className="rounded-sm bg-amber-400 px-1 text-[9px] font-bold text-black">광고</span>
            ) : (
              <span className="text-amber-400">🔥</span>
            )}
            <span className={s.sponsored ? "font-semibold text-amber-300" : "font-semibold"}>
              {s.storeName}
            </span>
            <span className="text-white/85">{s.title}</span>
            <span className="font-bold text-amber-300">{won(s.salePrice)}</span>
            {s.qty?.trim() && <span className="text-white/50">· {s.qty}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
