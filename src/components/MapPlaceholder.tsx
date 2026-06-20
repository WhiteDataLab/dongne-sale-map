/**
 * 지도 영역 자리 (Phase 0 셸).
 * Phase 1에서 Kakao Maps JS SDK 로 교체한다. 기본 중심 = 서울 동대문구 이문동.
 * TODO(phase-1): Kakao Maps SDK 렌더링, 기본 중심 이문동 좌표, bounds 내 가게 핀
 */
export function MapPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-2">
      <div className="flex flex-col items-center gap-2 text-center text-ink-3">
        <div className="text-4xl">🗺️</div>
        <p className="text-sm">지도 영역 (Phase 1에서 카카오맵 연동)</p>
        <p className="text-xs">기본 중심: 서울 동대문구 이문동</p>
      </div>
    </div>
  );
}
