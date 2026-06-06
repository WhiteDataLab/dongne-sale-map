"use client";

import { starString } from "@/lib/format";
import type { FeedReview } from "@/lib/types";

/**
 * 유튜브 채팅 느낌의 실시간 리뷰 스트림.
 * 아래에서 위로 천천히 올라가며, 상단으로 갈수록 마스크로 옅어지며 사라진다.
 * 트랙을 2번 반복해 무한 루프.
 */
export function ReviewStream({ reviews }: { reviews: FeedReview[] }) {
  if (reviews.length === 0) return null;
  const items = [...reviews, ...reviews];

  return (
    <div className="stream-mask pointer-events-none h-full w-full overflow-hidden">
      <div className="stream-track flex flex-col gap-2">
        {items.map((r, i) => (
          <div
            key={`${r.id}-${i}`}
            className="w-fit max-w-full rounded-2xl bg-white/80 px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm"
          >
            <span className="font-semibold text-gray-900">{r.nickname}</span>
            <span className="ml-1 text-[10px] text-amber-500">{starString(r.rating)}</span>
            <span className="ml-1 text-gray-600">{r.content}</span>
            <span className="ml-1 text-[10px] text-gray-400">· {r.storeName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
