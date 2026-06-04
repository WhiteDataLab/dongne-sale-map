"use client";

import { useEffect, useState } from "react";

const SCRIPT_ID = "kakao-maps-sdk";

/**
 * 카카오맵 JS SDK 를 1회만 주입하고 `kakao.maps.load` 까지 완료되면 loaded=true.
 * JS 키가 없으면(env 가드) 에러 메시지를 반환 — 지도 영역에서 안내 문구로 표시.
 */
export function useKakaoLoader(appKey?: string) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appKey) {
      setError("카카오맵 JS 키가 없어요 (NEXT_PUBLIC_KAKAO_MAP_JS_KEY).");
      return;
    }
    if (window.kakao?.maps) {
      setLoaded(true);
      return;
    }

    const onLoad = () => window.kakao.maps.load(() => setLoaded(true));
    const onError = () =>
      setError("카카오맵 SDK 로드 실패 — JS 키/플랫폼 도메인 등록을 확인해 주세요.");

    const existing = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", onError);
      return () => {
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", onError);
      };
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    // autoload=false → 명시적으로 kakao.maps.load 호출. services = 좌표↔주소 변환(역지오코딩)
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, [appKey]);

  return { loaded, error };
}
