import { won } from "@/lib/format";
import type { PriceTrend } from "@/lib/types";

/**
 * 품목별 세일가 변동 그래프 (크림식, 의존성 없는 SVG 스파크라인).
 * 가격 상승=빨강, 하락/동일=파랑. 최저~최고가와 최근가, 변동률 표시.
 */
export function PriceChart({ trend }: { trend: PriceTrend }) {
  const prices = trend.points.map((p) => p.p);
  const n = prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const first = prices[0];
  const last = prices[n - 1];
  const up = last >= first;
  const color = up ? "#ef4444" : "#2563eb";
  const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

  // viewBox 0 0 100 40, 위/아래 2 패딩
  const coords = trend.points.map((pt, i) => {
    const x = n === 1 ? 0 : (i / (n - 1)) * 100;
    const y = 38 - ((pt.p - min) / range) * 34;
    return [x, y] as const;
  });
  const d = coords.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(" ");
  const area = `${d} L100 40 L0 40 Z`;
  const lastFmt = (d: string) =>
    new Date(d).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });

  return (
    <div className="rounded-xl border border-line-2 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium">{trend.label}</p>
        <p className="shrink-0 text-sm font-bold" style={{ color }}>
          {won(last)}{" "}
          <span className="text-xs font-medium">
            {up ? "▲" : "▼"} {Math.abs(pct)}%
          </span>
        </p>
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-1.5 h-12 w-full">
        <path d={area} fill={color} fillOpacity={0.08} />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-ink-3">
        <span>{lastFmt(trend.points[0].t)} · 최저 {won(min)}</span>
        <span>최고 {won(max)} · {lastFmt(trend.points[n - 1].t)}</span>
      </div>
    </div>
  );
}
