"use client";

import type { LocalAdDTO } from "@/lib/localAds";

/**
 * L4 — 지도 상단 지역 광고 스트립(마퀴 아래). '광고' 라벨 필수.
 * 클릭 시 집계(POST) 후 외부 링크가 있으면 새 탭으로 연다.
 */
export function LocalAdStrip({ ads }: { ads: LocalAdDTO[] }) {
  if (ads.length === 0) return null;

  const onClick = (ad: LocalAdDTO) => {
    // 클릭 집계(best-effort)
    fetch(`/api/local-ads/${ad.id}/click`, { method: "POST", keepalive: true }).catch(() => {});
    if (ad.linkUrl) window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="pointer-events-auto mt-1.5 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ads.map((ad) => (
        <button
          key={ad.id}
          type="button"
          onClick={() => onClick(ad)}
          className="flex w-60 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-2 text-left shadow-sm backdrop-blur transition hover:bg-white"
        >
          <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
            {ad.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.imageUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-base text-gray-300">📣</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="rounded bg-gray-100 px-1 py-px text-[9px] font-medium text-gray-400">광고</span>
              <span className="truncate text-[11px] text-gray-400">{ad.advertiser} · {ad.category}</span>
            </div>
            <p className="truncate text-xs font-semibold text-gray-800">{ad.title}</p>
            <p className="truncate text-[11px] text-gray-500">{ad.body}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
