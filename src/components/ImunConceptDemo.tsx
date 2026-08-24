"use client";

// TODO(out-of-scope): 이 컴포넌트는 PROJECT_SPEC.md 페이즈 순서 밖의 "낙서 컨셉" 데모다.
// 실제 카카오맵 SDK는 쓰지만 가게 데이터는 하드코딩 목업이며 DB/동네 세일과 연동되지 않는다.
// 정식 채택 시 스펙(docs/PROJECT_SPEC.md)을 먼저 갱신하고 Phase로 편입한다.

import { useEffect, useMemo, useRef, useState } from "react";
import { useKakaoLoader } from "./useKakaoLoader";
import { DEFAULT_CENTER } from "@/lib/constants";
import { haversineMeters, formatDistance } from "@/lib/geo";

type Direction = "북" | "북동" | "동" | "남동" | "남" | "남서" | "서" | "북서";

type StoreCategory =
  | "대형마트"
  | "편의점"
  | "과일가게"
  | "정육점"
  | "꽃집"
  | "생활용품"
  | "빵집"
  | "반찬가게";

const CATEGORY_ICON: Record<StoreCategory, string> = {
  대형마트: "🛒",
  편의점: "🏪",
  과일가게: "🍎",
  정육점: "🥩",
  꽃집: "💐",
  생활용품: "🧻",
  빵집: "🍞",
  반찬가게: "🥘",
};

interface DemoItem {
  name: string;
  price: string;
  updatedAt: string; // YYYY-MM-DD
}

interface DemoStore {
  id: string;
  name: string;
  category: StoreCategory;
  lat: number;
  lng: number;
  verified: boolean;
  items: DemoItem[];
}

interface SourcePoint {
  label: string;
  lat: number;
  lng: number;
}

interface DongPoint {
  name: string;
  lat: number;
  lng: number;
  active: boolean;
}

// 동대문구 넓은 시야 중심(대략) — 이문동을 포함해 인접 동이 함께 보이는 지점.
const WIDE_CENTER = { lat: 37.5865, lng: 127.0555 };
const WIDE_LEVEL = 7;
const DONG_LEVEL = 4;

// 동대문구 동 목업 좌표 (대략 위치). 이문동만 클릭 가능, 나머지는 "준비중" 표시용.
const DONGS: DongPoint[] = [
  { name: "이문동", lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, active: true },
  { name: "회기동", lat: 37.5895, lng: 127.0574, active: false },
  { name: "청량리동", lat: 37.5803, lng: 127.0468, active: false },
  { name: "휘경동", lat: 37.5928, lng: 127.0645, active: false },
  { name: "전농동", lat: 37.5788, lng: 127.0561, active: false },
  { name: "답십리동", lat: 37.5723, lng: 127.0508, active: false },
];

// 이문동 출발지 후보 (아파트/빌라/오피스텔) — 후보2 컨셉의 목업.
const SOURCE_OPTIONS: SourcePoint[] = [
  { label: "이문아이파크자이", lat: 37.5978, lng: 127.0601 },
  { label: "래미안 엘리니티", lat: 37.5952, lng: 127.0577 },
  { label: "브라운스톤 이문", lat: 37.5991, lng: 127.0583 },
  { label: "휘경 SK뷰", lat: 37.5967, lng: 127.0645 },
  { label: "다세대빌라 (이문로 3길)", lat: 37.5959, lng: 127.0612 },
];

// 목업 가게 데이터. 실제 좌표/DB 대신 데모용 하드코딩.
const DEMO_STORES: DemoStore[] = [
  {
    id: "emart-imun",
    name: "이마트 이문점",
    category: "대형마트",
    lat: 37.6002,
    lng: 127.0559,
    verified: true,
    items: [
      { name: "딸기", price: "8,900원", updatedAt: "2026-08-21" },
      { name: "복숭아", price: "12,900원", updatedAt: "2026-08-23" },
      { name: "아이스크림", price: "1,200원", updatedAt: "2026-08-20" },
      { name: "두부", price: "1,590원", updatedAt: "2026-08-22" },
      { name: "휴지", price: "9,900원", updatedAt: "2026-08-18" },
    ],
  },
  {
    id: "homeplus-hwigyeong",
    name: "홈플러스 휘경점",
    category: "대형마트",
    lat: 37.5941,
    lng: 127.0668,
    verified: true,
    items: [
      { name: "장미", price: "3,000원/송이", updatedAt: "2026-08-19" },
      { name: "포켓몬빵", price: "1,800원", updatedAt: "2026-08-23" },
      { name: "두부", price: "1,490원", updatedAt: "2026-08-21" },
    ],
  },
  {
    id: "gs25-imun1",
    name: "GS25 이문1동점",
    category: "편의점",
    lat: 37.5983,
    lng: 127.061,
    verified: true,
    items: [
      { name: "아이스크림", price: "1,500원", updatedAt: "2026-08-24" },
      { name: "포켓몬빵", price: "2,000원", updatedAt: "2026-08-24" },
    ],
  },
  {
    id: "cu-imun-station",
    name: "CU 이문역점",
    category: "편의점",
    lat: 37.5966,
    lng: 127.0575,
    verified: true,
    items: [
      { name: "아이스크림", price: "1,400원", updatedAt: "2026-08-22" },
      { name: "휴지", price: "4,900원", updatedAt: "2026-08-15" },
    ],
  },
  {
    id: "fruit-imun",
    name: "이문 과일가게",
    category: "과일가게",
    lat: 37.5969,
    lng: 127.059,
    verified: false,
    items: [
      { name: "딸기", price: "7,000원", updatedAt: "2026-08-23" },
      { name: "복숭아", price: "10,000원", updatedAt: "2026-08-23" },
    ],
  },
  {
    id: "flower-cheongryangni",
    name: "청량리 꽃집",
    category: "꽃집",
    lat: 37.5803,
    lng: 127.0468,
    verified: false,
    items: [{ name: "장미", price: "2,500원/송이", updatedAt: "2026-08-20" }],
  },
  {
    id: "flower-imun-small",
    name: "이문 소담꽃집",
    category: "꽃집",
    lat: 37.5988,
    lng: 127.0568,
    verified: false,
    items: [{ name: "장미", price: "3,500원/송이", updatedAt: "2026-08-24" }],
  },
  {
    id: "daiso-dapsimni",
    name: "다이소 답십리점",
    category: "생활용품",
    lat: 37.5723,
    lng: 127.0508,
    verified: true,
    items: [{ name: "휴지", price: "3,900원", updatedAt: "2026-08-17" }],
  },
  {
    id: "banchan-imun",
    name: "이문 손맛반찬",
    category: "반찬가게",
    lat: 37.5975,
    lng: 127.0625,
    verified: false,
    items: [{ name: "두부", price: "1,300원", updatedAt: "2026-08-24" }],
  },
  {
    id: "bakery-jeonnong",
    name: "전농동 동네빵집",
    category: "빵집",
    lat: 37.5788,
    lng: 127.0561,
    verified: false,
    items: [{ name: "포켓몬빵", price: "1,900원", updatedAt: "2026-08-21" }],
  },
];

const RADIUS_OPTIONS = [
  { key: "dong", label: "이문동 내", meters: 1300 },
  { key: "neighbor", label: "인접동 확장", meters: 2800 },
  { key: "3km", label: "3km", meters: 3000 },
  { key: "5km", label: "5km", meters: 5000 },
] as const;

type RadiusKey = (typeof RADIUS_OPTIONS)[number]["key"];

const DIRECTIONS: Direction[] = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];

function directionFrom(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Direction {
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI; // 0=북, 90=동
  const normalized = (angle + 360) % 360;
  const idx = Math.round(normalized / 45) % 8;
  return DIRECTIONS[idx];
}

function daysAgo(dateStr: string) {
  const diff = Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff <= 0) return "오늘 업데이트";
  return `${diff}일 전 업데이트`;
}

type MatchedResult = {
  store: DemoStore;
  matched: DemoItem[];
  distance: number;
  direction: Direction;
};

type Step = "dong" | "source" | "search";

function clearOverlays(ref: React.MutableRefObject<any[]>) {
  ref.current.forEach((o) => o.setMap(null));
  ref.current = [];
}

function pinStyle({
  active,
  filled,
}: {
  active: boolean;
  filled: boolean;
}) {
  return `display:inline-flex;align-items:center;gap:4px;padding:7px 13px;border-radius:999px;
    font-size:12.5px;font-weight:800;white-space:nowrap;box-shadow:0 4px 14px rgba(25,31,40,.18);
    border:2px solid ${active ? "var(--blue)" : "var(--line)"};
    background:${filled ? "var(--blue)" : "#fff"};
    color:${filled ? "#fff" : "var(--ink-4)"};
    cursor:${active ? "pointer" : "default"};
    opacity:${active ? "1" : ".7"};`;
}

/** 이문동 컨셉 데모: 실제 카카오맵 위에서 동 클릭 → 출발지 선택 → 검색 결과 핀. */
export function ImunConceptDemo() {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;
  const { loaded, error } = useKakaoLoader(appKey);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const dongOverlaysRef = useRef<any[]>([]);
  const sourceOverlaysRef = useRef<any[]>([]);
  const storeOverlaysRef = useRef<any[]>([]);
  const sourceMarkerRef = useRef<any>(null);
  const topPanelRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>("dong");
  const [source, setSource] = useState<SourcePoint | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [query, setQuery] = useState("");
  const [radiusKey, setRadiusKey] = useState<RadiusKey>("dong");
  const [selected, setSelected] = useState<MatchedResult | null>(null);
  // 상단 플로팅 패널 높이 — 지도 핀이 패널 아래에 가려지지 않도록 bounds 여백으로 사용.
  const [topInset, setTopInset] = useState(140);

  useEffect(() => {
    const el = topPanelRef.current;
    if (!el) return;
    const measure = () => setTopInset(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const radius = RADIUS_OPTIONS.find((r) => r.key === radiusKey)!;

  const results = useMemo<MatchedResult[]>(() => {
    if (!source || !query.trim()) return [];
    const q = query.trim();
    return DEMO_STORES.flatMap((store) => {
      const matched = store.items.filter((item) => item.name.includes(q));
      if (matched.length === 0) return [];
      const distance = haversineMeters(source.lat, source.lng, store.lat, store.lng);
      if (distance > radius.meters) return [];
      return [{ store, matched, distance, direction: directionFrom(source, store) }];
    }).sort((a, b) => a.distance - b.distance);
  }, [source, query, radius]);

  // 지도 초기화 (1회) — 동대문구 넓은 시야 + 동 핀
  useEffect(() => {
    if (!loaded || !mapEl.current || mapRef.current) return;
    const { kakao } = window;
    const map = new kakao.maps.Map(mapEl.current, {
      center: new kakao.maps.LatLng(WIDE_CENTER.lat, WIDE_CENTER.lng),
      level: WIDE_LEVEL,
    });
    mapRef.current = map;
    renderDongPins();
    kakao.maps.event.addListener(map, "click", () => setSelected(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function renderDongPins() {
    const map = mapRef.current;
    if (!map || !window.kakao) return;
    const { kakao } = window;
    clearOverlays(dongOverlaysRef);
    for (const dong of DONGS) {
      const el = document.createElement("div");
      el.style.cssText = pinStyle({ active: dong.active, filled: dong.active });
      el.textContent = dong.active ? `📍 ${dong.name}` : dong.name;
      if (dong.active) el.addEventListener("click", () => selectDong(dong));
      else el.title = "아직 데이터가 없어요";
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(dong.lat, dong.lng),
        content: el,
        yAnchor: 0.5,
        clickable: true,
      });
      overlay.setMap(map);
      dongOverlaysRef.current.push(overlay);
    }
  }

  function selectDong(dong: DongPoint) {
    const map = mapRef.current;
    if (!map || !window.kakao) return;
    clearOverlays(dongOverlaysRef);
    map.setLevel(DONG_LEVEL);
    map.panTo(new window.kakao.maps.LatLng(dong.lat, dong.lng));
    setStep("source");
    renderSourcePins();
  }

  function renderSourcePins() {
    const map = mapRef.current;
    if (!map || !window.kakao) return;
    const { kakao } = window;
    clearOverlays(sourceOverlaysRef);
    for (const opt of SOURCE_OPTIONS) {
      const el = document.createElement("div");
      el.style.cssText = pinStyle({ active: true, filled: false });
      el.textContent = `🏢 ${opt.label}`;
      el.addEventListener("click", () => chooseSource(opt));
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(opt.lat, opt.lng),
        content: el,
        yAnchor: 1.6,
        clickable: true,
      });
      overlay.setMap(map);
      sourceOverlaysRef.current.push(overlay);
    }
  }

  function placeSourceMarker(point: SourcePoint) {
    const map = mapRef.current;
    if (!map || !window.kakao) return;
    const { kakao } = window;
    if (sourceMarkerRef.current) sourceMarkerRef.current.setMap(null);
    const el = document.createElement("div");
    el.className = "geo-dot";
    sourceMarkerRef.current = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(point.lat, point.lng),
      content: el,
      yAnchor: 0.5,
      zIndex: 3,
    });
    sourceMarkerRef.current.setMap(map);
  }

  function chooseSource(point: SourcePoint) {
    clearOverlays(sourceOverlaysRef);
    placeSourceMarker(point);
    setSource(point);
    setStep("search");
  }

  function submitCustomAddress() {
    if (!customAddress.trim()) return;
    // 데모: 직접 입력 주소는 실제 지오코딩 없이 이문동 기본 좌표를 씀.
    chooseSource({ label: customAddress.trim(), ...DEFAULT_CENTER });
  }

  function resetAll() {
    const map = mapRef.current;
    clearOverlays(sourceOverlaysRef);
    clearOverlays(storeOverlaysRef);
    if (sourceMarkerRef.current) {
      sourceMarkerRef.current.setMap(null);
      sourceMarkerRef.current = null;
    }
    setSource(null);
    setQuery("");
    setRadiusKey("dong");
    setSelected(null);
    setStep("dong");
    if (map && window.kakao) {
      map.setLevel(WIDE_LEVEL);
      map.panTo(new window.kakao.maps.LatLng(WIDE_CENTER.lat, WIDE_CENTER.lng));
    }
    renderDongPins();
  }

  // 검색 결과 → 지도 핀 렌더링 + 결과가 보이도록 시야 맞춤
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.kakao || step !== "search") return;
    const { kakao } = window;
    clearOverlays(storeOverlaysRef);

    for (const r of results) {
      const el = document.createElement("div");
      el.className = "store-pin" + (r.store.verified ? "" : " store-pin--gray");
      el.style.setProperty("--pin-color", r.store.verified ? "#3182f6" : "#9ca3af");
      const icon = document.createElement("span");
      icon.className = "store-pin__icon";
      icon.textContent = CATEGORY_ICON[r.store.category];
      const name = document.createElement("span");
      name.className = "store-pin__name";
      name.textContent = `${r.store.name} · ${r.matched[0].price}`;
      el.append(icon, name);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected(r);
      });
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(r.store.lat, r.store.lng),
        content: el,
        yAnchor: 1,
        zIndex: 4,
        clickable: true,
      });
      overlay.setMap(map);
      storeOverlaysRef.current.push(overlay);
    }

    if (results.length > 0 && source) {
      const bounds = new kakao.maps.LatLngBounds();
      bounds.extend(new kakao.maps.LatLng(source.lat, source.lng));
      for (const r of results) bounds.extend(new kakao.maps.LatLng(r.store.lat, r.store.lng));
      // 핀이 상단 플로팅 패널 아래에 가려지지 않도록 패널 높이만큼 상단 여백을 준다.
      map.setBounds(bounds, topInset + 24, 24, 32, 24);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, step, topInset]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapEl} className="h-full w-full bg-surface-2" />

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-2 p-6 text-center text-sm text-ink-3">
          {error}
        </div>
      )}

      {/* 상단 플로팅 패널 */}
      <div ref={topPanelRef} className="pointer-events-none absolute inset-x-0 top-0 z-10 p-4">
        <div className="pointer-events-auto mx-auto max-w-md space-y-2 rounded-card border border-line bg-surface/95 p-4 shadow-[var(--sh-2)] backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-base font-extrabold text-ink">우리 동네, 어디서 살까 🔍</h1>
              {step === "dong" && (
                <p className="mt-0.5 text-xs text-ink-3">지도에서 이문동을 눌러보세요 (다른 동은 준비 중)</p>
              )}
              {step === "source" && (
                <p className="mt-0.5 text-xs text-ink-3">🏢 마커를 눌러 출발지를 고르거나, 주소를 입력하세요.</p>
              )}
              {step === "search" && source && (
                <p className="mt-0.5 text-xs font-semibold text-brand-ink">📍 {source.label} 기준</p>
              )}
            </div>
            {step !== "dong" && (
              <button type="button" className="btn-bare shrink-0 text-xs" onClick={resetAll}>
                처음부터
              </button>
            )}
          </div>

          {step === "source" && (
            <div className="flex gap-2">
              <input
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="남은 주소를 직접 입력 (예: 이문로 12)"
                className="min-h-[var(--tap-min)] flex-1 rounded-row border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
              />
              <button type="button" className="btn-cta btn-cta--primary px-4" onClick={submitCustomAddress}>
                확인
              </button>
            </div>
          )}

          {step === "search" && (
            <div className="space-y-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="딸기, 장미, 두부, 휴지, 포켓몬빵…"
                className="w-full rounded-[var(--r-pill)] border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-brand"
              />
              <div className="flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRadiusKey(r.key)}
                    className={`rounded-[var(--r-pill)] border px-3 py-1 text-xs font-bold ${
                      radiusKey === r.key
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-surface text-ink-2"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {query.trim() && (
                <p className="text-xs font-semibold text-ink-3">
                  &ldquo;{query}&rdquo; {results.length}곳 · {radius.label} 기준
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 검색어는 있는데 결과가 없을 때 */}
      {step === "search" && query.trim() && results.length === 0 && !selected && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <div className="pointer-events-auto rounded-card border border-dashed border-line bg-surface px-4 py-3 text-center text-sm text-ink-3 shadow-[var(--sh-2)]">
            &ldquo;{query}&rdquo;를 파는 곳을 {radius.label} 범위에서 못 찾았어요. 반경을 넓혀보세요 ↑
          </div>
        </div>
      )}

      {/* 가게 상세(하단 시트) */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-20 p-4">
          <div className="mx-auto max-w-md rounded-card border border-line bg-surface p-4 shadow-[var(--sh-2)]">
            <div className="flex items-start gap-3">
              <div className="menu-ic">{CATEGORY_ICON[selected.store.category]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-ink">{selected.store.name}</span>
                  {selected.store.verified ? (
                    <span className="badge badge--verify">인증</span>
                  ) : (
                    <span className="badge" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
                      미인증
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs font-semibold text-brand-ink">
                  {selected.direction}쪽 {formatDistance(selected.distance)}
                </p>
              </div>
              <button
                type="button"
                className="btn-bare shrink-0 text-xs"
                onClick={() => setSelected(null)}
              >
                닫기
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {selected.matched.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-ink-2">{item.name}</span>
                  <span className="num font-bold text-ink">{item.price}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-ink-3">{daysAgo(selected.matched[0].updatedAt)}</p>
            <p className="mt-1 text-[11px] text-ink-4">🔗 나중에 동네 세일 데이터와 연동 예정</p>
            <a
              href={`https://map.kakao.com/link/search/${encodeURIComponent(selected.store.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-cta btn-cta--block btn-cta--primary mt-3"
            >
              카카오맵에서 보기
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
