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
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {
      // 사용자가 공유 취소 → 무시
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 실패 시 prompt 로 노출
      window.prompt("아래 링크를 복사하세요", url);
    }
  };

  return (
    <button type="button" onClick={onClick} className={className} aria-label="공유">
      {copied ? "✅ 복사됨" : (children ?? "🔗 공유")}
    </button>
  );
}
