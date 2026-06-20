"use client";

import { useEffect, useState } from "react";
import { starString } from "@/lib/format";
import type { FeedReview } from "@/lib/types";

/**
 * 유튜브 채팅 느낌의 실시간 리뷰 스트림.
 * 아래에서 위로 천천히 올라가며, 상단으로 갈수록 마스크로 옅어지며 사라진다.
 * 모바일에선 지도 가림을 줄이려 폰트·개수를 줄인다. 트랙을 2번 반복해 무한 루프.
 */
export function ReviewStream({ reviews }: { reviews: FeedReview[] }) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (reviews.length === 0) return null;
  // 모바일은 더 적게 노출(지도 가림 최소화)
  const base = reviews.slice(0, isMobile ? 5 : 12);
  // 항목이 적어도 세로로 끊김 없이 흐르도록 한 그룹을 충분히 채운 뒤 2배 복제
  const minPerHalf = isMobile ? 7 : 10;
  const repeat = Math.max(1, Math.ceil(minPerHalf / base.length));
  const half = Array.from({ length: repeat }, () => base).flat();
  const items = [...half, ...half];

  return (
    <div className="stream-mask pointer-events-none h-full w-full overflow-hidden">
      <div className="stream-track flex flex-col items-end gap-1.5 text-right sm:gap-2">
        {items.map((r, i) => (
          <div
            key={`${r.id}-${i}`}
            className="w-fit max-w-full rounded-2xl bg-white/80 px-2 py-1 text-[10px] leading-tight shadow-sm backdrop-blur-sm sm:px-3 sm:py-1.5 sm:text-xs"
          >
            <span className="font-semibold text-ink">{r.storeName}</span>
            <span className="ml-1 text-[9px] text-amber-500 sm:text-[10px]">{starString(r.rating)}</span>
            <span className="ml-1 text-ink-2">
              {r.content.length > 20 ? `${r.content.slice(0, 20)}…` : r.content}
            </span>
            <span className="ml-1 text-ink-3">- {r.nickname}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
