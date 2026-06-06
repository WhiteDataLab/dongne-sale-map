"use client";

import { useState } from "react";

/**
 * 공유 버튼: Web Share API 지원 시 OS 공유 시트, 미지원 시 링크 클립보드 복사.
 * path 는 앱 내 절대경로(예: "/s/abc"). 런타임에 origin 을 붙여 전체 URL 생성.
 */
export function ShareButton({
  path,
  title,
  text,
  className,
  children,
}: {
  path: string;
  title: string;
  text?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        // 사용자가 취소(AbortError)면 그대로 종료, 그 외 실패면 클립보드로 폴백
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("아래 링크를 복사하세요", url);
    }
  };

  return (
    <button type="button" onClick={onClick} className={className} aria-label="공유">
      {copied ? "✅ 복사됨" : (children ?? "🔗 공유")}
    </button>
  );
}
