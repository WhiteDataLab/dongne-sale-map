"use client";

import { useCallback, useEffect, useRef } from "react";
import { useKakaoLoader } from "./useKakaoLoader";
import { DEFAULT_CENTER } from "@/lib/constants";

/**
 * 지도에서 좌표를 찍어 주소를 자동 기입 (Phase 7c+: 가게 등록 편의).
 * 클릭/탭한 지점에 마커를 놓고 역지오코딩(services)으로 주소를 부모에 전달.
 */
export function MapPicker({
  initial,
  onPick,
}: {
  initial?: { lat: number; lng: number } | null;
  onPick: (v: { lat: number; lng: number; address: string }) => void;
}) {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;
  const { loaded, error } = useKakaoLoader(appKey);
  const el = useRef<HTMLDivElement>(null);
  // 무타입 SDK
  const markerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const reverse = useCallback((lat: number, lng: number) => {
    const { kakao } = window;
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any, status: string) => {
      let address = "";
      if (status === kakao.maps.services.Status.OK && result[0]) {
        address = result[0].road_address?.address_name || result[0].address?.address_name || "";
      }
      onPickRef.current({ lat, lng, address });
    });
  }, []);

  useEffect(() => {
    if (!loaded || !el.current) return;
    const { kakao } = window;
    const center = new kakao.maps.LatLng(
      initial?.lat ?? DEFAULT_CENTER.lat,
      initial?.lng ?? DEFAULT_CENTER.lng,
    );
    const map = new kakao.maps.Map(el.current, { center, level: 3 });
    mapRef.current = map;
    const marker = new kakao.maps.Marker({ position: center });
    markerRef.current = marker;
    if (initial) marker.setMap(map);

    kakao.maps.event.addListener(map, "click", (e: any) => {
      const ll = e.latLng;
      marker.setPosition(ll);
      marker.setMap(map);
      reverse(ll.getLat(), ll.getLng());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, reverse]);

  const goToMyLocation = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { kakao } = window;
        const ll = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        mapRef.current.setCenter(ll);
        markerRef.current.setPosition(ll);
        markerRef.current.setMap(mapRef.current);
        reverse(pos.coords.latitude, pos.coords.longitude);
      },
      () => {}, // 권한 거부/실패 시 무시
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  if (error) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg bg-surface-2 p-4 text-center text-xs text-ink-3">
        지도를 불러올 수 없어요. ({error})
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="relative">
        <div ref={el} className="h-56 w-full bg-surface-2" />
        <button
          type="button"
          onClick={goToMyLocation}
          aria-label="현재 위치"
          className="absolute right-2 top-2 z-10 flex size-10 items-center justify-center rounded-full bg-white text-lg shadow-md active:bg-surface-2"
        >
          📍
        </button>
      </div>
      <p className="bg-surface-2 px-3 py-1.5 text-xs text-ink-3">
        지도를 눌러 가게 위치를 선택하거나, 📍로 현재 위치를 찾으세요. 주소는 자동으로 채워져요.
      </p>
    </div>
  );
}
