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

  if (error) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg bg-gray-100 p-4 text-center text-xs text-gray-500">
        지도를 불러올 수 없어요. ({error})
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div ref={el} className="h-56 w-full bg-gray-100" />
      <p className="bg-gray-50 px-3 py-1.5 text-xs text-gray-400">
        지도를 눌러 가게 위치를 선택하면 주소가 자동으로 채워져요.
      </p>
    </div>
  );
}
