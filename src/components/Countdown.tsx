"use client";

import { useEffect, useState } from "react";

/**
 * 세일 마감까지 실시간 카운트다운 (쿠팡식 긴급성).
 * - 1시간 이상: "N시간 M분 남음"
 * - 1시간 미만: "MM:SS 남음" (초 단위 갱신, 빨강 강조)
 * - 마감: "마감"
 */
export function Countdown({ to, className = "" }: { to: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  const target = new Date(to).getTime();
  const remain = target - now;
  const urgent = remain > 0 && remain < 60 * 60 * 1000;

  useEffect(() => {
    if (remain <= 0) return;
    // 1시간 미만이면 1초, 이상이면 30초 간격으로 갱신
    const interval = remain < 60 * 60 * 1000 ? 1000 : 30000;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [remain]);

  let text: string;
  if (remain <= 0) {
    text = "마감";
  } else if (remain >= 60 * 60 * 1000) {
    const h = Math.floor(remain / 3_600_000);
    const m = Math.floor((remain % 3_600_000) / 60_000);
    text = `${h}시간 ${m}분 남음`;
  } else {
    const m = Math.floor(remain / 60_000);
    const s = Math.floor((remain % 60_000) / 1000);
    text = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} 남음`;
  }

  return (
    <span
      className={[
        "tabular-nums",
        remain <= 0 ? "text-gray-400" : urgent ? "font-semibold text-orange-600" : "text-gray-500",
        className,
      ].join(" ")}
    >
      {urgent && remain > 0 ? "⏰ " : ""}
      {text}
    </span>
  );
}
