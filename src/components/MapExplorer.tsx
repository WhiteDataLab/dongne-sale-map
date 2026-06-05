"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haversineMeters } from "@/lib/geo";
import { useKakaoLoader } from "./useKakaoLoader";
import { SearchBar } from "./SearchBar";
import { FilterBar, type Filters } from "./FilterBar";
import { StoreSheet } from "./StoreSheet";
import { StoreRegisterForm } from "./StoreRegisterForm";
import { DEFAULT_CENTER, DEFAULT_LEVEL, CATEGORY_META } from "@/lib/constants";
import type { StoreDTO } from "@/lib/types";

/**
 * Phase 1 지도 화면: 카카오맵 렌더링 + 검색 이동 + bounds 핀 + 필터.
 * 기본 중심 = 이문동. 미인증 가게는 회색 핀, 클릭 시 "인증 진행중" 안내.
 * 가게 상세(바텀시트)는 Phase 2 → 지금은 안내만.
 */
type Place = {
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  phone: string;
  category: string;
};

export function MapExplorer() {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;
  const { loaded, error } = useKakaoLoader(appKey);

  const mapEl = useRef<HTMLDivElement>(null);
  // 카카오맵 인스턴스/오버레이는 무타입 SDK 라 any. (사유: 공식 타입 미제공)
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const myLocRef = useRef<any>(null);

  const [stores, setStores] = useState<StoreDTO[]>([]);
  const [filters, setFilters] = useState<Filters>({
    category: "all",
    onlySale: false,
  });
  const [loadingStores, setLoadingStores] = useState(false);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [results, setResults] = useState<Place[] | null>(null);
  const [registerMode, setRegisterMode] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const router = useRouter();

  const registerModeRef = useRef(false);
  registerModeRef.current = registerMode;
  const registerMarkerRef = useRef<any>(null);
  // 등록 모드에서 커서를 따라다니는 '꽂기 전' 미리보기 핀
  const ghostRef = useRef<any>(null);

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

    // 등록 모드에서 커서를 따라다니는 미리보기 핀 (꽂기 전 시각화)
    kakao.maps.event.addListener(map, "mousemove", (e: { latLng: any }) => {
      if (!registerModeRef.current) {
        if (ghostRef.current) ghostRef.current.setMap(null);
        return;
      }
      if (!ghostRef.current) {
        const el = document.createElement("div");
        el.className = "pin-ghost";
        el.textContent = "📍";
        ghostRef.current = new kakao.maps.CustomOverlay({
          content: el,
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: 4,
        });
      }
      ghostRef.current.setPosition(e.latLng);
      ghostRef.current.setMap(map);
    });
    // 지도 밖으로 커서가 나가면 미리보기 핀 숨김
    kakao.maps.event.addListener(map, "mouseout", () => {
      if (ghostRef.current) ghostRef.current.setMap(null);
    });

    // 가게 등록 모드: 지도 탭 → 좌표 선택 + 역지오코딩으로 주소 자동
    kakao.maps.event.addListener(map, "click", (e: { latLng: { getLat(): number; getLng(): number } }) => {
      if (!registerModeRef.current) return;
      const lat = e.latLng.getLat();
      const lng = e.latLng.getLng();
      if (registerMarkerRef.current) registerMarkerRef.current.setMap(null);
      // 떨어지듯 꽂히는 핀(CustomOverlay) — 클릭 위치에 드롭 애니메이션
      const pinEl = document.createElement("div");
      pinEl.className = "pin-drop";
      pinEl.textContent = "📍";
      registerMarkerRef.current = new kakao.maps.CustomOverlay({
        position: e.latLng,
        content: pinEl,
        xAnchor: 0.5,
        yAnchor: 1,
        zIndex: 6,
      });
      registerMarkerRef.current.setMap(map);
      try {
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.coord2Address(lng, lat, (result: { road_address?: { address_name?: string }; address?: { address_name?: string } }[], status: string) => {
          let address = "";
          if (status === kakao.maps.services.Status.OK && result[0]) {
            address = result[0].road_address?.address_name || result[0].address?.address_name || "";
          }
          setPicked({ lat, lng, address });
        });
      } catch {
        setPicked({ lat, lng, address: "" });
      }
    });

    // 딥링크(/?store=&lat=&lng=) — 즐겨찾기 등에서 위치 무관하게 바로 상세 열기
    const params = new URLSearchParams(window.location.search);
    const qStore = params.get("store");
    if (qStore) {
      const qLat = Number(params.get("lat"));
      const qLng = Number(params.get("lng"));
      if (Number.isFinite(qLat) && Number.isFinite(qLng)) {
        map.setCenter(new kakao.maps.LatLng(qLat, qLng));
      }
      setSelectedStoreId(qStore);
    }
    if (params.get("register") === "1") setRegisterMode(true);
  }, [loaded, fetchStores]);

  const exitRegister = useCallback(() => {
    setRegisterMode(false);
    setPicked(null);
    if (registerMarkerRef.current) {
      registerMarkerRef.current.setMap(null);
      registerMarkerRef.current = null;
    }
    if (ghostRef.current) ghostRef.current.setMap(null);
  }, []);

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

  // 현재 위치로 지도 이동 (좌표 저장 안 함 — 지도 이동 보조용)
  const goToMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      flashNotice("이 기기에서는 위치를 사용할 수 없어요.");
      return;
    }
    flashNotice("현재 위치를 찾는 중…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map) return;
        const { kakao } = window;
        const ll = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        map.setCenter(ll);
        // 현재 위치 파란 점 표시 (좌표 저장 안 함 — 화면 표시용)
        if (!myLocRef.current) {
          const el = document.createElement("div");
          el.className = "geo-dot";
          myLocRef.current = new kakao.maps.CustomOverlay({
            position: ll,
            content: el,
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: 5,
          });
        }
        myLocRef.current.setPosition(ll);
        myLocRef.current.setMap(map);
        fetchStores();
      },
      (err) => {
        flashNotice(
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요."
            : "현재 위치를 가져오지 못했어요.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }, [fetchStores, flashNotice]);

  const handleSearch = useCallback(
    async (q: string) => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q });
        const c = mapRef.current?.getCenter?.();
        if (c) {
          params.set("x", String(c.getLng()));
          params.set("y", String(c.getLat()));
        }
        const res = await fetch(`/api/places?${params.toString()}`);
        const data = (await res.json()) as { places?: Place[] };
        const places = data.places ?? [];
        if (places.length === 0) {
          flashNotice("검색 결과가 없어요.");
          setResults(null);
          return;
        }
        setResults(places);
      } catch {
        flashNotice("검색 중 오류가 발생했어요.");
      } finally {
        setSearching(false);
      }
    },
    [flashNotice],
  );

  // 검색 결과(카카오 장소) 선택 → 이미 등록된 가게면 열기, 아니면 빠른 등록(prefill)
  const pickPlace = useCallback(
    async (pl: Place) => {
      setResults(null);
      const map = mapRef.current;
      if (map) map.setCenter(new window.kakao.maps.LatLng(pl.lat, pl.lng));
      try {
        const d = 0.0009; // ~100m
        const res = await fetch(
          `/api/stores?swLat=${pl.lat - d}&swLng=${pl.lng - d}&neLat=${pl.lat + d}&neLng=${pl.lng + d}`,
        );
        const data = (await res.json()) as { stores?: StoreDTO[] };
        const near = (data.stores ?? []).find(
          (s) => haversineMeters(s.lat, s.lng, pl.lat, pl.lng) < 60,
        );
        if (near) {
          setSelectedStoreId(near.id);
          fetchStores();
          return;
        }
      } catch {
        // 무시하고 등록으로
      }
      const qs = new URLSearchParams({
        name: pl.name,
        address: pl.roadAddress || pl.address,
        lat: String(pl.lat),
        lng: String(pl.lng),
      });
      if (pl.phone) qs.set("phone", pl.phone);
      router.push(`/stores/new?${qs.toString()}`);
    },
    [fetchStores, router],
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
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} pending={searching} />
          </div>
          <button
            type="button"
            onClick={goToMyLocation}
            aria-label="현재 위치"
            className="pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-md transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            📍
          </button>
        </div>

        {results && (
          <div className="pointer-events-auto max-h-64 overflow-y-auto rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 text-xs text-gray-400">
              <span>검색 결과 {results.length}곳 — 누르면 가게 보기/등록</span>
              <button type="button" onClick={() => setResults(null)}>
                닫기
              </button>
            </div>
            <ul className="divide-y divide-gray-50">
              {results.map((pl, i) => (
                <li key={`${pl.name}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pickPlace(pl)}
                    className="block w-full px-3 py-2.5 text-left hover:bg-gray-50"
                  >
                    <p className="truncate text-sm font-medium">
                      {pl.name}
                      {pl.category && <span className="ml-1 text-xs text-gray-400">{pl.category}</span>}
                    </p>
                    <p className="truncate text-xs text-gray-500">{pl.roadAddress || pl.address}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

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

      {/* 가게 등록 FAB → 지도에서 바로 좌표 찍어 등록 */}
      {!error && !selectedStoreId && !registerMode && (
        <button
          type="button"
          onClick={() => {
            setResults(null);
            setSelectedStoreId(null);
            setRegisterMode(true);
          }}
          className="absolute bottom-5 right-4 z-20 flex items-center gap-1 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          ➕ 가게 등록
        </button>
      )}

      {/* 등록 모드 안내 배너 */}
      {registerMode && !picked && (
        <div className="pointer-events-none absolute inset-x-0 top-28 z-30 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-blue-600 px-4 py-2 text-sm text-white shadow-lg">
            📍 지도를 눌러 가게 위치를 선택하세요
            <button type="button" onClick={exitRegister} className="font-semibold underline-offset-2">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 인라인 가게 등록 폼 */}
      {registerMode && picked && (
        <StoreRegisterForm
          point={picked}
          onCancel={exitRegister}
          onToast={flashNotice}
          onDone={() => {
            exitRegister();
            fetchStores();
          }}
        />
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
