"use client";

import type { FeedCounts } from "@/lib/types";

/**
 * 라이브 카운터 헤드라인 (콜드스타트 P0-3, 러브버그맵 "이번 주 제보 6,360건" 패턴).
 * 현 지도 영역의 오늘 제보·세일중·마감임박 수를 실시간 표시해 생동감·FOMO 를 만든다.
 * 데이터가 0이어도 막다른 화면 대신 '첫 제보' 초대 카피로 폴백.
 */
export function LiveHeadline({ counts }: { counts: FeedCounts | null }) {
  if (!counts) return null;
  const { region, todayReports, soonExpiring, activeSales } = counts;
  const hasAction = todayReports > 0 || activeSales > 0;

  return (
    <div className="pointer-events-none flex justify-center">
      <p className="pointer-events-auto inline-flex max-w-full items-center gap-1 truncate rounded-full bg-ink/85 px-3.5 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur">
        {hasAction ? (
          <>
            📢 {region} 오늘 세일 제보{" "}
            <b className="num text-amber-300">{todayReports}</b>건
            {activeSales > 0 && (
              <>
                {" · "}세일중 <b className="num text-amber-300">{activeSales}</b>곳
              </>
            )}
            {soonExpiring > 0 && (
              <>
                {" · "}⏰ 마감임박 <b className="num text-amber-300">{soonExpiring}</b>곳
              </>
            )}
          </>
        ) : (
          <>🛒 {region} 오늘의 떨이·세일 — 첫 제보의 주인공이 돼보세요!</>
        )}
      </p>
    </div>
  );
}
