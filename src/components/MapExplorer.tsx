"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useKakaoLoader } from "./useKakaoLoader";
import { SearchBar } from "./SearchBar";
import { FilterBar, type Filters } from "./FilterBar";
import { StoreSheet } from "./StoreSheet";
import { DEFAULT_CENTER, DEFAULT_LEVEL, CATEGORY_META } from "@/lib/constants";
import type { GeocodeResult, StoreDTO } from "@/lib/types";

/**
 * Phase 1 지도 화면: 카카오맵 렌더링 + 검색 이동 + bounds 핀 + 필터.
 * 기본 중심 = 이문동. 미인증 가게는 회색 핀, 클릭 시 "인증 진행중" 안내.
 * 가게 상세(바텀시트)는 Phase 2 → 지금은 안내만.
 */
export function MapExplorer() {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;
  const { loaded, error } = useKakaoLoader(appKey);

  const mapEl = useRef<HTMLDivElement>(null);
  // 카카오맵 인스턴스/오버레이는 무타입 SDK 라 any. (사유: 공식 타입 미제공)
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);

  const [stores, setStores] = useState<StoreDTO[]>([]);
  const [filters, setFilters] = useState<Filters>({
    category: "all",
    onlySale: false,
  });
  const [loadingStores, setLoadingStores] = useState(false);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // 최신 filters 를 idle 리스너에서 참조하기 위한 ref
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2200);
  }, []);

  const fetchStores = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const f = filtersRef.current;

    const params = new URLSearchParams({
      swLat: String(sw.getLat()),
      swLng: String(sw.getLng()),
      neLat: String(ne.getLat()),
      neLng: String(ne.getLng()),
    });
    if (f.category !== "all") params.set("category", f.category);
    if (f.onlySale) params.set("onlySale", "1");

    setLoadingStores(true);
    try {
      const res = await fetch(`/api/stores?${params.toString()}`);
      const data = (await res.json()) as { stores?: StoreDTO[] };
      setStores(data.stores ?? []);
    } catch {
      setStores([]);
    } finally {
      setLoadingStores(false);
    }
  }, []);

  // 지도 초기화 (1회)
  useEffect(() => {
    if (!loaded || !mapEl.current || mapRef.current) return;
    const { kakao } = window;
    const map = new kakao.maps.Map(mapEl.current, {
      center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      level: DEFAULT_LEVEL,
    });
    mapRef.current = map;
    // 이동/확대 종료 시 현 영역 가게 재조회
    kakao.maps.event.addListener(map, "idle", fetchStores);
    fetchStores();
  }, [loaded, fetchStores]);

  // 필터 변경 시 재조회
  useEffect(() => {
    if (mapRef.current) fetchStores();
  }, [filters, fetchStores]);

  // 가게 목록 → 핀(커스텀 오버레이) 렌더링
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.kakao) return;
    const { kakao } = window;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    for (const s of stores) {
      const el = buildPinElement(s, () => {
        if (!s.verified) {
          flashNotice(`'${s.name}' 은 인증 진행중인 가게예요.`);
          return;
        }
        setSelectedStoreId(s.id);
      });
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(s.lat, s.lng),
        content: el,
        yAnchor: 1,
        clickable: true,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    }
  }, [stores, flashNotice]);

  const handleSearch = useCallback(
    async (q: string) => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          flashNotice(err.error ?? "검색 결과가 없어요.");
          return;
        }
        const r = (await res.json()) as GeocodeResult;
        const map = mapRef.current;
        if (map) {
          map.setCenter(new window.kakao.maps.LatLng(r.lat, r.lng));
          fetchStores();
        }
      } catch {
        flashNotice("검색 중 오류가 발생했어요.");
      } finally {
        setSearching(false);
      }
    },
    [fetchStores, flashNotice],
  );

  return (
    <div className="relative h-full w-full">
      {/* 지도 */}
      <div ref={mapEl} className="h-full w-full bg-gray-100" />

      {/* 키 없음/로드 실패 안내 */}
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100 p-6 text-center">
          <div className="max-w-sm text-sm text-gray-500">
            <p className="mb-2 text-3xl">🗺️</p>
            <p className="font-medium text-gray-700">지도를 불러올 수 없어요</p>
            <p className="mt-1">{error}</p>
            <p className="mt-3 text-xs">
              카카오 개발자 콘솔에서 <b>플랫폼 &gt; Web</b> 에
              <br />
              <code>http://localhost:3000</code> 도메인 등록이 필요해요.
            </p>
          </div>
        </div>
      )}

      {/* 상단 오버레이: 검색 + 필터 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        <SearchBar onSearch={handleSearch} pending={searching} />
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* 빈 상태 (스펙 6장) */}
      {!error && !loadingStores && stores.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <div className="rounded-2xl bg-black/75 px-4 py-3 text-center text-sm text-white shadow-lg">
            이 동네는 아직 정보가 없어요.
            <br />첫 제보를 남겨보세요! (제보는 Phase 3)
          </div>
        </div>
      )}

      {/* 토스트 안내 */}
      {notice && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-50 flex justify-center px-4">
          <div className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
            {notice}
          </div>
        </div>
      )}

      {/* 가게 등록 FAB (Phase 6) */}
      {!error && !selectedStoreId && (
        <Link
          href="/stores/new"
          className="absolute bottom-5 right-4 z-20 flex items-center gap-1 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          ➕ 가게 등록
        </Link>
      )}

      {/* 가게 상세 바텀시트 (Phase 2) */}
      <StoreSheet
        storeId={selectedStoreId}
        onClose={() => setSelectedStoreId(null)}
        onToast={flashNotice}
      />
    </div>
  );
}

/** 핀(커스텀 오버레이) DOM 생성: [카테고리 아이콘 | 가게명]. 미인증=회색. */
function buildPinElement(store: StoreDTO, onClick: () => void): HTMLElement {
  const meta = CATEGORY_META[store.category];
  const isOwner = store.source === "merchant";
  const wrap = document.createElement("div");
  wrap.className =
    "store-pin" +
    (store.verified ? "" : " store-pin--gray") +
    (isOwner ? " store-pin--owner" : "");
  wrap.style.setProperty("--pin-color", store.verified ? meta.color : "#9ca3af");

  // 사장님 등록 가게는 왕관 마크로 구분
  if (isOwner) {
    const crown = document.createElement("span");
    crown.className = "store-pin__crown";
    crown.textContent = "👑";
    wrap.appendChild(crown);
  }

  const icon = document.createElement("span");
  icon.className = "store-pin__icon";
  icon.textContent = meta.icon;

  const name = document.createElement("span");
  name.className = "store-pin__name";
  name.textContent = store.name;

  wrap.append(icon, name);
  if (store.hasActiveSale && store.verified) {
    const badge = document.createElement("span");
    badge.className = "store-pin__sale";
    badge.textContent = "세일";
    wrap.appendChild(badge);
  }

  wrap.addEventListener("click", onClick);
  return wrap;
}
