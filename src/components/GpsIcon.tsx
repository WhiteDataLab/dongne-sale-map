/**
 * GPS/현재위치 크로스헤어(조준점) 아이콘.
 * flaticon GPS(target) 스타일을 외부 의존성 없는 인라인 SVG 로 재현 — 외부요청 0, CSP 안전.
 * 색은 `currentColor` 를 따르므로 부모의 text-색상으로 제어한다.
 */
export function GpsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <line x1="12" y1="2" x2="12" y2="5.5" />
      <line x1="12" y1="18.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5.5" y2="12" />
      <line x1="18.5" y1="12" x2="22" y2="12" />
    </svg>
  );
}
