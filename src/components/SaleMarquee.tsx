"use client";

import { won } from "@/lib/format";
import type { FeedSale } from "@/lib/types";

/**
 * 지도 상단 광고판: 현 지역 최신 세일을 가로로 흘려보낸다(마퀴).
 * 데이터가 적어도 자연스럽게 보이도록 트랙을 2번 반복해 무한 루프.
 */
export function SaleMarquee({ sales }: { sales: FeedSale[] }) {
  if (sales.length === 0) return null;
  const items = [...sales, ...sales]; // seamless loop

  return (
    <div className="pointer-events-none overflow-hidden rounded-full bg-black/75 py-1.5 text-white shadow-lg backdrop-blur-sm">
      <div className="marquee-track">
        {items.map((s, i) => (
          <span key={`${s.id}-${i}`} className="mx-4 inline-flex items-center gap-1.5 text-xs">
            <span className="text-amber-400">🔥</span>
            <span className="font-semibold">{s.storeName}</span>
            <span className="text-white/85">{s.title}</span>
            <span className="font-bold text-amber-300">{won(s.salePrice)}</span>
            <span className="text-white/50">· {s.qty}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
