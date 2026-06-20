"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haversineMeters } from "@/lib/geo";
import { useKakaoLoader } from "./useKakaoLoader";
import { SearchBar } from "./SearchBar";
import { FilterBar, type Filters } from "./FilterBar";
import { StoreSheet } from "./StoreSheet";
import { StoreRegisterForm } from "./StoreRegisterForm";
import { SaleMarquee } from "./SaleMarquee";
import { SaleListPanel } from "./SaleListPanel";
import { ReviewStream } from "./ReviewStream";
import { LocalAdStrip } from "./LocalAdStrip";
import { GpsIcon } from "./GpsIcon";
import { trackImpressions } from "@/lib/track";
import { DEFAULT_CENTER, DEFAULT_LEVEL, CATEGORY_META } from "@/lib/constants";
import type { StoreDTO, FeedSale, FeedReview } from "@/lib/types";
import type { LocalAdDTO } from "@/lib/localAds";

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
  // 상단 오버레이(검색+필터) 바닥 위치 — 등록 시트 최대화 시 여기 직전까지만 펼침
  const topOverlayRef = useRef<HTMLDivElement>(null);
  const [topInset, setTopInset] = useState(120);
  // 카카오맵 인스턴스/오버레이는 무타입 SDK 라 any. (사유: 공식 타입 미제공)
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const myLocRef = useRef<any>(null);

  const [stores, setStores] = useState<StoreDTO[]>([]);
  const [filters, setFilters] = useState<Filters>({
    category: "all",
    onlySale: false,
    onlyOpen: false,
    onlySoon: false,
  });
  const [loadingStores, setLoadingStores] = useState(false);
  const [showList, setShowList] = useState(false); // 세일 목록 패널 토글
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [results, setResults] = useState<Place[] | null>(null);
  const [registerMode, setRegisterMode] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [feed, setFeed] = useState<{ sales: FeedSale[]; reviews: FeedReview[]; localAds: LocalAdDTO[] }>({ sales: [], reviews: [], localAds: [] });
  const feedSigRef = useRef("");
  // 현재 위치(좌표 미저장 — 거리 표시/지도 이동용 화면 상태)
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
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
      let list = data.stores ?? [];
      // 영업중·마감임박은 DTO 기준 클라이언트 필터(서버 재호출 불필요)
      if (f.onlyOpen) list = list.filter((s) => s.isOpenNow === true);
      if (f.onlySoon) list = list.filter((s) => s.saleSoonExpiring);
      setStores(list);
    } catch {
      setStores([]);
    } finally {
      setLoadingStores(false);
    }
  }, []);

  // 현 지도 영역의 실시간 피드(최신 세일 광고판 + 리뷰 스트림)
  const fetchFeed = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const params = new URLSearchParams({
      swLat: String(sw.getLat()),
      swLng: String(sw.getLng()),
      neLat: String(ne.getLat()),
      neLng: String(ne.getLng()),
    });
    try {
      const res = await fetch(`/api/feed?${params.toString()}`);
      const data = (await res.json()) as { sales?: FeedSale[]; reviews?: FeedReview[]; localAds?: LocalAdDTO[] };
      const sales = data.sales ?? [];
      const reviews = data.reviews ?? [];
      const localAds = data.localAds ?? [];
      // 데이터가 동일하면 갱신 생략 → 마퀴/스트림 애니메이션이 폴링마다 끊기지 않게
      const sig = `${sales.map((s) => s.id).join(",")}|${reviews.map((r) => r.id).join(",")}|${localAds.map((a) => a.id).join(",")}`;
      if (sig !== feedSigRef.current) {
        feedSigRef.current = sig;
        setFeed({ sales, reviews, localAds });
      }
    } catch {
      // 무시(피드는 부가 효과)
    }
  }, []);

  // 실시간성: 18초마다 현 영역 피드 갱신
  useEffect(() => {
    const id = window.setInterval(() => fetchFeed(), 18000);
    return () => window.clearInterval(id);
  }, [fetchFeed]);

  // 지도 초기화 (1회)
  useEffect(() => {
    if (!loaded || !mapEl.current || mapRef.current) return;
    const { kakao } = window;
    const map = new kakao.maps.Map(mapEl.current, {
      center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      level: DEFAULT_LEVEL,
    });
    mapRef.current = map;
    // 이동/확대 종료 시 현 영역 가게 + 피드 재조회
    kakao.maps.event.addListener(map, "idle", fetchStores);
    kakao.maps.event.addListener(map, "idle", fetchFeed);
    fetchStores();
    fetchFeed();

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
  }, [loaded, fetchStores, fetchFeed]);

  // 상단 오버레이 높이 측정(검색+필터). 시트 최대화 한계로 사용.
  useEffect(() => {
    const el = topOverlayRef.current;
    if (!el) return;
    const measure = () => setTopInset(el.getBoundingClientRect().bottom);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const exitRegister = useCallback(() => {
    setRegisterMode(false);
    setPicked(null);
    if (registerMarkerRef.current) {
      registerMarkerRef.current.setMap(null);
      registerMarkerRef.current = null;
    }
    if (ghostRef.current) ghostRef.current.setMap(null);
  }, []);

  // 프로필 사진(메뉴) 열 때 → 지도에 열린 가게 등록/상세 패널 닫기
  useEffect(() => {
    const closeAll = () => {
      setSelectedStoreId(null);
      setResults(null);
      exitRegister();
    };
    window.addEventListener("app:overlay-close", closeAll);
    return () => window.removeEventListener("app:overlay-close", closeAll);
  }, [exitRegister]);

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

    const addPin = (s: StoreDTO) => {
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
    };

    // 줌아웃(레벨 높음) 시 가까운 가게를 묶어 클러스터 버블로 표시(호갱노노식).
    // 클릭하면 해당 위치로 줌인 → idle 재조회로 자동 디클러스터링.
    const level = map.getLevel();
    if (level >= CLUSTER_LEVEL && stores.length > 1) {
      for (const c of groupByGrid(map, stores, CLUSTER_GRID)) {
        if (c.items.length === 1) {
          addPin(c.items[0]);
          continue;
        }
        const el = buildClusterElement(c, () => {
          map.setLevel(Math.max(1, level - 2), { anchor: new kakao.maps.LatLng(c.lat, c.lng) });
        });
        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(c.lat, c.lng),
          content: el,
          yAnchor: 0.5,
          clickable: true,
        });
        overlay.setMap(map);
        overlaysRef.current.push(overlay);
      }
    } else {
      for (const s of stores) addPin(s);
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
        setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); // 거리 표시용(미저장)
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

  // 줌 인/아웃 (카카오식 ＋/－ 컨트롤). 레벨이 낮을수록 확대.
  const zoomIn = useCallback(() => {
    const map = mapRef.current;
    if (map) map.setLevel(map.getLevel() - 1, { animate: true });
  }, []);
  const zoomOut = useCallback(() => {
    const map = mapRef.current;
    if (map) map.setLevel(map.getLevel() + 1, { animate: true });
  }, []);

  // M0(수익화): 화면(bounds) 내 가게 노출 이벤트 집계(세션당 가게별 1회로 중복 억제).
  useEffect(() => {
    if (stores.length > 0) trackImpressions(stores.map((s) => s.id), "pin");
  }, [stores]);

  // 거리 표시용 위치 요청(지도 이동 없이 myLoc 만 갱신). 가게 상세의 '거리 보기'에서 호출.
  const locateForDistance = useCallback(() => {
    if (!navigator.geolocation) {
      flashNotice("이 기기에서는 위치를 사용할 수 없어요.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        flashNotice(
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요."
            : "현재 위치를 가져오지 못했어요.",
        ),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, [flashNotice]);

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

  const saleCount = stores.filter((s) => s.hasActiveSale && s.verified).length;

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
      <div ref={topOverlayRef} className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} pending={searching} />
          </div>
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

        {/* 현 지역 최신 세일 광고판 (가로 마퀴) — 누르면 가게 상세 열림 */}
        {!registerMode && (
          <SaleMarquee
            sales={feed.sales}
            onSelect={(id) => {
              setResults(null);
              setSelectedStoreId(id);
            }}
          />
        )}

        {/* L4: 지역 광고 스트립(로컬 광고주, '광고' 라벨) */}
        {!registerMode && <LocalAdStrip ads={feed.localAds} />}
      </div>

      {/* 실시간 리뷰 스트림 (우측 상단, 아래→위로 올라가며 옅어짐) */}
      {!error && !registerMode && feed.reviews.length > 0 && (
        <div className="pointer-events-none absolute right-1.5 top-36 z-[5] h-[32%] w-[46%] max-w-[150px] sm:right-2 sm:top-40 sm:h-[44%] sm:w-[60%] sm:max-w-[250px]">
          <ReviewStream reviews={feed.reviews} />
        </div>
      )}

      {/* 빈 상태 (스펙 6장) */}
      {!error && !loadingStores && stores.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <div className="rounded-2xl bg-black/75 px-4 py-3 text-center text-sm text-white shadow-lg">
            이 동네는 아직 정보가 없어요.
            <br />첫 제보를 남겨보세요!
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

      {/* 지도 컨트롤 (카카오식): 현재위치 / 확대(＋) / 축소(－) 세로 스택 */}
      {!error && !registerMode && !showList && (
        <div
          className={[
            "absolute bottom-24 right-4 z-20 flex-col items-center gap-2",
            // 모바일에서 가게 상세(바텀시트)가 열리면 가려지므로 숨김(FAB 와 동일 규칙). 데스크톱은 유지.
            selectedStoreId ? "hidden sm:flex" : "flex",
          ].join(" ")}
        >
          {/* 현재 위치 */}
          <button
            type="button"
            onClick={goToMyLocation}
            aria-label="현재 위치"
            className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-white text-gray-700 shadow-md transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <GpsIcon className="size-5" />
          </button>
          {/* 확대 / 축소 (한 묶음) */}
          <div className="pointer-events-auto flex flex-col overflow-hidden rounded-full bg-white shadow-md">
            <button
              type="button"
              onClick={zoomIn}
              aria-label="확대"
              className="flex size-11 items-center justify-center text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="size-5" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <div className="mx-2.5 h-px bg-gray-200" />
            <button
              type="button"
              onClick={zoomOut}
              aria-label="축소"
              className="flex size-11 items-center justify-center text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="size-5" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 가게 등록 FAB → 지도에서 바로 좌표 찍어 등록 */}
      {!error && !registerMode && !showList && (
        <button
          type="button"
          onClick={() => {
            setResults(null);
            setSelectedStoreId(null);
            setRegisterMode(true);
          }}
          className={[
            "absolute bottom-5 right-4 z-20 items-center gap-1 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 active:bg-blue-800",
            // 모바일에서 가게 상세(바텀시트)가 열리면 가려지므로 숨김. 데스크톱(좌측 패널)은 유지.
            selectedStoreId ? "hidden sm:flex" : "flex",
          ].join(" ")}
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
          topInsetPx={topInset}
          onCancel={exitRegister}
          onToast={flashNotice}
          onDone={() => {
            exitRegister();
            fetchStores();
          }}
        />
      )}

      {/* 세일 목록 보기 토글 (지도 ↔ 목록) */}
      {!error && !registerMode && !selectedStoreId && !showList && saleCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setResults(null);
            setShowList(true);
          }}
          className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-black"
        >
          📋 세일 목록 {saleCount}
        </button>
      )}

      {/* 세일 목록 패널 */}
      {!error && !registerMode && showList && (
        <SaleListPanel
          stores={stores}
          onSelect={(id) => {
            setShowList(false);
            setSelectedStoreId(id);
          }}
          onClose={() => setShowList(false)}
        />
      )}

      {/* 가게 상세 바텀시트 (Phase 2) */}
      <StoreSheet
        storeId={selectedStoreId}
        onClose={() => setSelectedStoreId(null)}
        onToast={flashNotice}
        userLoc={myLoc}
        onLocate={locateForDistance}
      />
    </div>
  );
}

/** 핀(커스텀 오버레이) DOM 생성: [카테고리 아이콘 | 가게명]. 미인증=회색.
 *  사장님(merchant) 등록/인증 가게도 지도에선 카테고리 아이콘만 — 구분 표시는 가게 상세에서만. */
// 줌아웃 클러스터링 설정: 레벨이 이 값 이상(더 멀리)일 때 묶음, 화면을 N등분한 격자로 그룹화.
const CLUSTER_LEVEL = 6;
const CLUSTER_GRID = 7;

type Cluster = { lat: number; lng: number; items: StoreDTO[] };

/** 현재 보이는 영역을 격자(grid×grid)로 나눠 같은 칸의 가게들을 묶는다. */
function groupByGrid(map: { getBounds: () => any }, stores: StoreDTO[], grid: number): Cluster[] {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const minLng = sw.getLng();
  const minLat = sw.getLat();
  const cw = (ne.getLng() - minLng) / grid || 1;
  const ch = (ne.getLat() - minLat) / grid || 1;

  const cells = new Map<string, StoreDTO[]>();
  for (const s of stores) {
    const cx = Math.floor((s.lng - minLng) / cw);
    const cy = Math.floor((s.lat - minLat) / ch);
    const key = `${cx}:${cy}`;
    const g = cells.get(key);
    if (g) g.push(s);
    else cells.set(key, [s]);
  }

  return [...cells.values()].map((items) => ({
    lat: items.reduce((a, s) => a + s.lat, 0) / items.length,
    lng: items.reduce((a, s) => a + s.lng, 0) / items.length,
    items,
  }));
}

/** 클러스터 버블(개수 + 최저 세일가). 클릭 시 줌인. */
function buildClusterElement(cluster: Cluster, onClick: () => void): HTMLElement {
  const el = document.createElement("div");
  el.className = "store-cluster";

  const count = document.createElement("span");
  count.className = "store-cluster__count";
  count.textContent = String(cluster.items.length);
  el.appendChild(count);

  const sale = cluster.items.filter((s) => s.hasActiveSale && s.saleMinPrice != null);
  if (sale.length > 0) {
    const min = Math.min(...sale.map((s) => s.saleMinPrice as number));
    const price = document.createElement("span");
    price.className = "store-cluster__price";
    price.textContent = `🔥${min.toLocaleString("ko-KR")}원~`;
    el.appendChild(price);
  }

  el.addEventListener("click", onClick);
  return el;
}

function buildPinElement(store: StoreDTO, onClick: () => void): HTMLElement {
  const meta = CATEGORY_META[store.category];
  const wrap = document.createElement("div");
  // M1-A: 노출 중 스폰서(인증 가게)는 금색 핀으로 강조.
  const sponsored = store.sponsored && store.verified;
  wrap.className =
    "store-pin" + (store.verified ? "" : " store-pin--gray") + (sponsored ? " store-pin--sponsor" : "");
  wrap.style.setProperty("--pin-color", store.verified ? meta.color : "#9ca3af");

  const icon = document.createElement("span");
  icon.className = "store-pin__icon";
  icon.textContent = sponsored ? "👑" : meta.icon;

  // M3/M4: 받을 수 있는 쿠폰 보유 가게는 🎟️ 코너 배지(발견성).
  if (store.hasCoupon) {
    const cp = document.createElement("span");
    cp.className = "store-pin__coupon";
    cp.textContent = "🎟️";
    wrap.appendChild(cp);
  }

  // 상태 우선순위: 폐업 제보 > 오늘 휴업 제보 > 영업종료(시간) > 세일 > 기본
  const tag = (text: string, cls: string) => {
    const b = document.createElement("span");
    b.className = `store-pin__status ${cls}`;
    b.textContent = text;
    wrap.appendChild(b);
  };
  const nameEl = () => {
    const name = document.createElement("span");
    name.className = "store-pin__name";
    name.textContent = store.name;
    return name;
  };

  if (store.shutdownReports > 0) {
    wrap.classList.add("store-pin--shutdown");
    wrap.append(icon, nameEl());
    tag("폐업?", "store-pin__status--shutdown");
  } else if (store.closedTodayReports > 0) {
    wrap.classList.add("store-pin--alert");
    wrap.append(icon, nameEl());
    tag("오늘 휴업?", "store-pin__status--today");
  } else if (store.openStatus === "preparing") {
    wrap.classList.add("store-pin--off");
    wrap.append(icon, nameEl());
    tag("영업준비중", "store-pin__status--off");
  } else if (store.openStatus === "closed") {
    wrap.classList.add("store-pin--off");
    wrap.append(icon, nameEl());
    tag("영업종료", "store-pin__status--off");
  } else if (store.hasActiveSale && store.verified) {
    // P1-a 시그니처: '가격이 주인공'. 이름 대신 큰 가격(800) 카드 + 마감임박 deal 칩.
    wrap.classList.add("store-pin--deal");
    const soon = store.saleSoonExpiring;
    const price = document.createElement("span");
    price.className = "store-pin__price num";
    if (store.saleMinPrice != null) {
      price.append(document.createTextNode(store.saleMinPrice.toLocaleString("ko-KR")));
      const small = document.createElement("small");
      small.textContent = "원~";
      price.appendChild(small);
    } else {
      price.textContent = "세일중";
    }
    wrap.append(icon, price);
    if (soon) {
      wrap.classList.add("store-pin--soon");
      const chip = document.createElement("span");
      chip.className = "store-pin__soonchip";
      chip.textContent = "⏰ " + soonLabel(store.saleSoonestExpiry);
      wrap.appendChild(chip);
    }
  } else {
    // 기본(세일 없음): 이름 핀
    wrap.append(icon, nameEl());
  }

  wrap.addEventListener("click", onClick);
  return wrap;
}

/** 마감임박 칩 라벨: 남은 시간을 'N분'(60분 미만)/'1시간'(이상)으로. 핀은 idle/폴링 때 재생성. */
function soonLabel(iso?: string | null): string {
  if (!iso) return "마감임박";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "마감";
  const m = Math.round(ms / 60000);
  return m >= 60 ? "1시간" : `${m}분`;
}
