"use client";

// TODO(out-of-scope): 이 컴포넌트는 PROJECT_SPEC.md 페이즈 순서 밖의 "낙서 컨셉" 데모다.
// 실제 카카오맵 SDK는 쓰지만 가게 데이터는 하드코딩 목업이며 DB/동네 세일과 연동되지 않는다.
// 정식 채택 시 스펙(docs/PROJECT_SPEC.md)을 먼저 갱신하고 Phase로 편입한다.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKakaoLoader } from "./useKakaoLoader";
import { GpsIcon } from "./GpsIcon";
import { DEFAULT_CENTER } from "@/lib/constants";
import { haversineMeters, formatDistance } from "@/lib/geo";
import { DONG_BOUNDARIES, findDongAt, type DongBoundary } from "@/lib/dongBoundaries";
import { GU_BOUNDARIES } from "@/lib/guBoundaries";

type Direction = "북" | "북동" | "동" | "남동" | "남" | "남서" | "서" | "북서";

type StoreCategory =
  | "대형마트"
  | "편의점"
  | "과일가게"
  | "채소가게"
  | "정육점"
  | "꽃집"
  | "생활용품"
  | "빵집"
  | "반찬가게";

const CATEGORY_ICON: Record<StoreCategory, string> = {
  대형마트: "🛒",
  편의점: "🏪",
  과일가게: "🍎",
  채소가게: "🥬",
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
  dong: string; // 소속 동 — 동 클릭 시 그 동의 가게만 골라 보여주는 데 사용
  verified: boolean;
  items: DemoItem[];
}

interface SourcePoint {
  label: string;
  lat: number;
  lng: number;
  icon?: string; // 기본값 🏢(아파트 예외 2곳)
}

// 가장 넓은 시야(구 단위) 중심 — 동대문구+인접 4개 구(중랑·성북·성동·광진)가 함께 보이는 지점.
const GU_WIDE_CENTER = { lat: 37.579, lng: 127.058 };
const GU_LEVEL = 9;
// 이 레벨(더 넓게 줌아웃) 이상이면 동은 숨기고 구만 보이게 — 동/구가 동시에 보여 혼잡해지는 것 방지.
const GU_DONG_SWITCH_LEVEL = 8;

// 동대문구 넓은 시야 중심(대략) — 이문동을 포함해 인접 동이 함께 보이는 지점.
const WIDE_CENTER = { lat: 37.5865, lng: 127.0555 };
const WIDE_LEVEL = 7;
const DONG_LEVEL = 4;

// 실제 데이터(출발지·가게)가 있는 구/동. 나머지는 경계선만 보여주고 "준비중" 안내.
const DATA_READY_GU = "동대문구";
const DATA_READY_DONG = "이문동";

// 이문동 출발지 후보 — 후보2 컨셉의 목업.
// 대형마트·편의점·학교(공식 카테고리로 조회했던 것)는 전부 제거하고, 아파트 2곳만
// 예외로 유지. 지하철역은 이문동 전용이 아니라 아래 SUBWAY_STATIONS(전 지역 공통
// 레이어)로 분리했다.
const SOURCE_OPTIONS: SourcePoint[] = [
  { label: "이문아이파크자이", lat: 37.598186166296394, lng: 127.06346879756117 },
  { label: "래미안 라그란데", lat: 37.6000844489313, lng: 127.060230587332 },
];

interface SubwayStation {
  name: string;
  lat: number;
  lng: number;
  dong: string; // 소속 동(우리 6개 동 기준)
}

// 지하철역(카카오 공식 카테고리 SW8) — 이문동만이 아니라 우리가 다루는 6개 동
// 전체에서 조회한 실제 역 좌표. 같은 역의 노선별 중복(회기역 1호선/경의중앙선/
// 경춘선 등)은 대표 좌표 하나로 합쳤다. 넓은 시야(WIDE)에선 안 보이고, 동을
// 클릭해 확대했을 때 그 동 소속 역만 표시된다(renderDongContent). 이문동
// 역(신이문역·외대앞역)만 클릭 시 실제로 "출발지로 선택"까지 동작한다.
const SUBWAY_STATIONS: SubwayStation[] = [
  { name: "신이문역", lat: 37.6017816437084, lng: 127.067398003775, dong: "이문동" },
  { name: "외대앞역", lat: 37.596274142656114, lng: 127.06369251145765, dong: "이문동" },
  { name: "회기역", lat: 37.5897962196601, lng: 127.058048369273, dong: "휘경동" },
  { name: "청량리역", lat: 37.580037056302906, lng: 127.04472723023305, dong: "청량리동" },
  { name: "답십리역", lat: 37.56697480965114, lng: 127.05256127651293, dong: "답십리동" },
];

// 목업 가게 데이터. 실제 좌표/DB 대신 데모용 하드코딩.
// 아래 체인 매장 5곳은 이름·좌표 모두 카카오 로컬 키워드 검색으로 실재 지점을 찾아 반영함
// (기존엔 대충 지어낸 좌표라 실제 지도와 어긋났음 — 이제 실제 지도상 정확한 위치).
const DEMO_STORES: DemoStore[] = [
  {
    id: "emart-everyday-imun",
    name: "이마트에브리데이 이문점",
    category: "대형마트",
    lat: 37.59849154178327,
    lng: 127.06188598263597,
    dong: "이문동",
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
    id: "gs-the-fresh-imun-parkxi",
    name: "GS더프레시 이문파크자이점",
    category: "대형마트",
    lat: 37.59908111129766,
    lng: 127.06298149595398,
    dong: "이문동",
    verified: true,
    items: [
      { name: "포켓몬빵", price: "1,800원", updatedAt: "2026-08-23" },
      { name: "두부", price: "1,490원", updatedAt: "2026-08-21" },
    ],
  },
  {
    id: "gs25-imun-canvas",
    name: "GS25 이문캔버스점",
    category: "편의점",
    lat: 37.5971915355627,
    lng: 127.061649373943,
    dong: "이문동",
    verified: true,
    items: [
      { name: "아이스크림", price: "1,500원", updatedAt: "2026-08-24" },
      { name: "포켓몬빵", price: "2,000원", updatedAt: "2026-08-24" },
    ],
  },
  {
    id: "cu-imun-gold",
    name: "CU 이문골드점",
    category: "편의점",
    lat: 37.6009213156062,
    lng: 127.062262826867,
    dong: "이문동",
    verified: true,
    items: [
      { name: "아이스크림", price: "1,400원", updatedAt: "2026-08-22" },
      { name: "휴지", price: "4,900원", updatedAt: "2026-08-15" },
    ],
  },
  {
    id: "gs25-dapsimni-hanyang",
    name: "GS25 답십리한양점",
    category: "편의점",
    lat: 37.57266897198723,
    lng: 127.06036471674499,
    dong: "답십리동",
    verified: true,
    items: [{ name: "휴지", price: "3,900원", updatedAt: "2026-08-17" }],
  },
  // 아래는 서비스 컨셉상 "동네 사람들이 제보로 등록한(카카오 POI엔 없는) 동네 가게" 목업
  // — 실제 상호는 아니고, 좌표만 각 동 경계 안에 들어오도록 findDongAt 으로 검증해 배치함.
  // 6개 동 전부 최소 1곳씩은 있도록 회기동·휘경동에 채소가게를 새로 추가함.
  {
    id: "fruit-imun",
    name: "이문 과일가게",
    category: "과일가게",
    lat: 37.5969,
    lng: 127.059,
    dong: "이문동",
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
    lat: 37.588816,
    lng: 127.045304,
    dong: "청량리동",
    verified: false,
    items: [{ name: "장미", price: "2,500원/송이", updatedAt: "2026-08-20" }],
  },
  {
    id: "flower-imun-small",
    name: "이문 소담꽃집",
    category: "꽃집",
    lat: 37.5988,
    lng: 127.0568,
    dong: "이문동",
    verified: false,
    items: [{ name: "장미", price: "3,500원/송이", updatedAt: "2026-08-24" }],
  },
  {
    id: "banchan-imun",
    name: "이문 손맛반찬",
    category: "반찬가게",
    lat: 37.5975,
    lng: 127.0625,
    dong: "이문동",
    verified: false,
    items: [{ name: "두부", price: "1,300원", updatedAt: "2026-08-24" }],
  },
  {
    id: "veggie-hoegi",
    name: "회기동 싱싱채소",
    category: "채소가게",
    lat: 37.593709,
    lng: 127.051481,
    dong: "회기동",
    verified: false,
    items: [{ name: "당근", price: "2,000원", updatedAt: "2026-08-22" }],
  },
  {
    id: "veggie-hwigyeong",
    name: "휘경동 텃밭마켓",
    category: "채소가게",
    lat: 37.588233,
    lng: 127.064494,
    dong: "휘경동",
    verified: false,
    items: [{ name: "양파", price: "1,500원", updatedAt: "2026-08-25" }],
  },
  {
    id: "bakery-jeonnong",
    name: "전농동 동네빵집",
    category: "빵집",
    lat: 37.5788,
    lng: 127.0561,
    dong: "전농동",
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
  // 검색 결과(출발지 기준 거리 계산됨)에서만 채워짐. 동 둘러보기(browse) 모드에선 비워둠.
  distance?: number;
  direction?: Direction;
};

type Step = "gu" | "dong" | "source" | "search" | "empty";

function clearOverlays(ref: React.MutableRefObject<any[]>) {
  ref.current.forEach((o) => o.setMap(null));
  ref.current = [];
}

// 지우지 않고 보이기/숨기기만 전환(구↔동 레벨 전환 시 재생성 비용 없이 토글).
function setOverlaysVisible(ref: React.MutableRefObject<any[]>, map: any | null) {
  ref.current.forEach((o) => o.setMap(map));
}

const FLY_DURATION = 650;

// 특정 좌표로 부드럽게 이동한 뒤(panTo), 그 자리에서 부드럽게 확대(setLevel)한다.
// setLevel 의 anchor 옵션과 panTo 를 동시에 실행하면 서로의 중심 계산이 꼬여
// 엉뚱하게 줌아웃되는 버그가 있었음 — 그래서 "이동 완료(idle) → 그 자리에서 줌"
// 순서로 확실히 분리한다. idle 이 안 오는 경우(이미 그 위치인 경우 등)를 대비해
// 타임아웃 안전장치도 둔다.
function flyTo(map: any, target: { lat: number; lng: number }, level: number, duration = FLY_DURATION) {
  const { kakao } = window;
  const ll = new kakao.maps.LatLng(target.lat, target.lng);
  let zoomed = false;
  const doZoom = () => {
    if (zoomed) return;
    zoomed = true;
    kakao.maps.event.removeListener(map, "idle", doZoom);
    map.setLevel(level, { animate: { duration } });
  };
  kakao.maps.event.addListener(map, "idle", doZoom);
  window.setTimeout(doZoom, 700);
  map.panTo(ll);
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

// 동 경계 폴리곤 스타일 — 선택된 동은 파란 강조, 나머지는 옅은 회색 윤곽선.
// (구 레벨은 아래 guPolygonStyle 에서 보라색 계열로 완전히 다르게 — 구/동을 헷갈리지 않도록)
function dongPolygonStyle(selected: boolean) {
  return selected
    ? { strokeWeight: 3, strokeColor: "#3182f6", strokeOpacity: 0.9, fillColor: "#3182f6", fillOpacity: 0.12 }
    : { strokeWeight: 1.5, strokeColor: "#9ca3af", strokeOpacity: 0.55, fillColor: "#ffffff", fillOpacity: 0.02 };
}

// 동 라벨은 둥근 알약(pill) 모양 + 파란색 — 구 라벨(각진 칩 + 보라색)과 모양 자체를 다르게 해서
// 지도만 봐도 지금 "구 단위"인지 "동 단위"인지 구분되게 한다.
function dongLabelStyle(selected: boolean) {
  return `display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:999px;
    font-size:12.5px;font-weight:800;white-space:nowrap;box-shadow:0 4px 14px rgba(25,31,40,.18);
    border:2px solid ${selected ? "var(--blue)" : "var(--line)"};
    background:${selected ? "var(--blue)" : "#fff"};
    color:${selected ? "#fff" : "var(--ink-3)"};
    cursor:pointer;`;
}

const GU_ACCENT = "#8b5cf6"; // 보라색 — 동 레벨(파란색)과 확실히 구분되는 구 레벨 전용 색

// 구 경계 폴리곤 스타일. 데이터가 있는 구(동대문구)만 보라색 실선, 나머지는 회색 빗금 느낌의
// 점선(공사중) — 클릭이 안 되는 상태임을 색만으로도 알 수 있게.
function guPolygonStyle(active: boolean, selected: boolean) {
  if (!active) {
    return { strokeWeight: 1.5, strokeColor: "#b0b8c1", strokeOpacity: 0.6, fillColor: "#9ca3af", fillOpacity: 0.15 };
  }
  return selected
    ? { strokeWeight: 3, strokeColor: GU_ACCENT, strokeOpacity: 0.9, fillColor: GU_ACCENT, fillOpacity: 0.14 }
    : { strokeWeight: 2, strokeColor: GU_ACCENT, strokeOpacity: 0.65, fillColor: GU_ACCENT, fillOpacity: 0.05 };
}

// 구 라벨은 각진 칩(모서리만 살짝 둥근) 모양 — 동 라벨(완전한 알약)과 형태 자체가 다름.
function guLabelStyle(active: boolean, selected: boolean) {
  if (!active) {
    return `display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:8px;
      font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(25,31,40,.12);
      border:1.5px dashed #b0b8c1;background:#f3f4f6;color:#9ca3af;cursor:not-allowed;`;
  }
  return `display:inline-flex;align-items:center;gap:4px;padding:7px 14px;border-radius:8px;
    font-size:13px;font-weight:800;white-space:nowrap;box-shadow:0 4px 14px rgba(25,31,40,.18);
    border:2px solid ${GU_ACCENT};
    background:${selected ? GU_ACCENT : "#fff"};
    color:${selected ? "#fff" : "#6d28d9"};
    cursor:pointer;`;
}

/** 이문동 컨셉 데모: 실제 카카오맵 위에서 동 클릭 → 출발지 선택 → 검색 결과 핀. */
export function ImunConceptDemo() {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;
  const { loaded, error } = useKakaoLoader(appKey);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const guPolygonsRef = useRef<any[]>([]); // GU_BOUNDARIES 와 같은 순서로 대응
  const guLabelsRef = useRef<any[]>([]);
  const dongPolygonsRef = useRef<any[]>([]); // DONG_BOUNDARIES 와 같은 순서로 대응
  const dongLabelsRef = useRef<any[]>([]);
  const dongContentOverlaysRef = useRef<any[]>([]); // 선택된 동의 지하철역+동네가게(둘러보기 모드) 핀
  const sourceOverlaysRef = useRef<any[]>([]);
  const storeOverlaysRef = useRef<any[]>([]);
  const sourceMarkerRef = useRef<any>(null);
  const gpsMarkerRef = useRef<any>(null);
  const topPanelRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>("gu");
  const stepRef = useRef<Step>("gu"); // idle 이벤트 핸들러(맵 초기화 시 1회 등록)가 최신 step 을 보도록
  stepRef.current = step;
  const [selectedGuName, setSelectedGuName] = useState<string | null>(null);
  const [selectedDongName, setSelectedDongName] = useState<string | null>(null);
  const [source, setSource] = useState<SourcePoint | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [query, setQuery] = useState("");
  const [radiusKey, setRadiusKey] = useState<RadiusKey>("dong");
  const [selected, setSelected] = useState<MatchedResult | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [debugMsg, setDebugMsg] = useState<string | null>(null); // TODO(debug): 진단용, 원인 파악 후 제거
  // 상단 플로팅 패널 높이 — 지도 핀이 패널 아래에 가려지지 않도록 bounds 여백으로 사용.
  const [topInset, setTopInset] = useState(140);

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2400);
  }, []);

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

  // 지도 초기화 (1회) — 구 단위 넓은 시야 + 구 경계 폴리곤(항상 유지, 선택 시 스타일만 갱신)
  useEffect(() => {
    if (!loaded || !mapEl.current || mapRef.current) return;
    // TODO(debug): 구 라벨이 배포본에서 렌더링되지 않는 이슈 추적용 임시 try/catch. 원인 파악 후 제거.
    try {
    const { kakao } = window;
    const map = new kakao.maps.Map(mapEl.current, {
      center: new kakao.maps.LatLng(GU_WIDE_CENTER.lat, GU_WIDE_CENTER.lng),
      level: GU_LEVEL,
    });
    mapRef.current = map;

    for (const gu of GU_BOUNDARIES) {
      const polygon = new kakao.maps.Polygon({
        path: gu.path.map((p: { lat: number; lng: number }) => new kakao.maps.LatLng(p.lat, p.lng)),
        ...guPolygonStyle(gu.active, false),
      });
      polygon.setMap(map);
      guPolygonsRef.current.push(polygon);

      const el = document.createElement("div");
      el.style.cssText = guLabelStyle(gu.active, false);
      el.textContent = gu.active ? gu.name : `🚧 ${gu.name}`;
      if (gu.active) {
        kakao.maps.event.addListener(polygon, "click", () => enterDongdaemun());
        el.addEventListener("click", () => enterDongdaemun());
      } else {
        const notifyUnderConstruction = () =>
          flashNotice(`${gu.name}는 아직 공사중이에요. 지금은 ${DATA_READY_GU}만 볼 수 있어요.`);
        kakao.maps.event.addListener(polygon, "click", notifyUnderConstruction);
        el.addEventListener("click", notifyUnderConstruction);
      }
      const label = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(gu.center.lat, gu.center.lng),
        content: el,
        yAnchor: 0.5,
        clickable: true,
      });
      label.setMap(map);
      guLabelsRef.current.push(label);
    }

    kakao.maps.event.addListener(map, "click", () => setSelected(null));
    // 줌 레벨이 실제로 바뀔 때마다 확인하되, 300ms 동안 더 이상 안 바뀔 때(=완전히 멈췄을 때)만
    // 판단한다. flyTo 로 우리가 직접 줌을 애니메이션시키는 도중에도 이 이벤트가 여러 번 오는데,
    // 매번 즉시 판단하면 "패닝만 끝나고 아직 우리 setLevel 이 적용되기 전"인 중간 순간(레벨이
    // 잠깐 구 레벨 그대로인 상태)에 스스로 접혀버리는 문제가 있었다 — 디바운스로 최종 레벨만 본다.
    let switchTimer: number | null = null;
    kakao.maps.event.addListener(map, "zoom_changed", () => {
      if (switchTimer) window.clearTimeout(switchTimer);
      switchTimer = window.setTimeout(() => {
        if (map.getLevel() >= GU_DONG_SWITCH_LEVEL && stepRef.current !== "gu") {
          collapseToGu();
        }
      }, 300);
    });
    setDebugMsg(`init done, guPolys=${guPolygonsRef.current.length}`);
    } catch (e: any) {
      setDebugMsg(`INIT ERROR: ${e?.message || String(e)}`);
      console.error("map init error", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // 선택된 구가 바뀌면 폴리곤/라벨 스타일만 갱신(재생성하지 않음 — 경계선은 항상 지도에 남아있음).
  useEffect(() => {
    GU_BOUNDARIES.forEach((gu, i) => {
      const selected = gu.name === selectedGuName;
      const polygon = guPolygonsRef.current[i];
      const label = guLabelsRef.current[i];
      if (polygon) polygon.setOptions(guPolygonStyle(gu.active, selected));
      if (label) {
        const content = label.getContent() as HTMLElement;
        content.style.cssText = guLabelStyle(gu.active, selected);
      }
    });
  }, [selectedGuName]);

  // 동 경계 폴리곤을 1회만 그린다(이미 그려져 있으면 재생성하지 않음). 뷰 상태는 건드리지 않는
  // 순수 준비 작업 — goToDong 의 안전장치(GPS로 구 레벨에서 바로 동으로 진입하는 경우 등)로도 쓰인다.
  function ensureDongPolygonsCreated() {
    const map = mapRef.current;
    if (!map || !window.kakao || dongPolygonsRef.current.length > 0) return;
    const { kakao } = window;
    for (const dong of DONG_BOUNDARIES) {
      const style = dongPolygonStyle(false);
      const polygon = new kakao.maps.Polygon({
        path: dong.path.map((p: { lat: number; lng: number }) => new kakao.maps.LatLng(p.lat, p.lng)),
        ...style,
      });
      polygon.setMap(map);
      kakao.maps.event.addListener(polygon, "click", () => goToDong(dong));
      dongPolygonsRef.current.push(polygon);

      const el = document.createElement("div");
      el.style.cssText = dongLabelStyle(false);
      el.textContent = dong.name;
      el.addEventListener("click", () => goToDong(dong));
      const label = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(dong.center.lat, dong.center.lng),
        content: el,
        yAnchor: 0.5,
        clickable: true,
      });
      label.setMap(map);
      dongLabelsRef.current.push(label);
    }
  }

  // 구 레벨에서 동대문구를 클릭했을 때: 동 경계를 준비하고, 구 경계는 숨기고 동 경계로 전환한 뒤
  // 동 목록 전체가 보이는 시야로 이동한다.
  function enterDongdaemun() {
    const map = mapRef.current;
    if (!map || !window.kakao) return;
    ensureDongPolygonsCreated();
    setOverlaysVisible(guPolygonsRef, null);
    setOverlaysVisible(guLabelsRef, null);
    setOverlaysVisible(dongPolygonsRef, map);
    setOverlaysVisible(dongLabelsRef, map);
    setSelectedGuName(DATA_READY_GU);
    clearOverlays(sourceOverlaysRef);
    clearOverlays(storeOverlaysRef);
    clearOverlays(dongContentOverlaysRef);
    if (sourceMarkerRef.current) {
      sourceMarkerRef.current.setMap(null);
      sourceMarkerRef.current = null;
    }
    setSource(null);
    setQuery("");
    setRadiusKey("dong");
    setSelected(null);
    setSelectedDongName(null);
    flyTo(map, WIDE_CENTER, WIDE_LEVEL);
    setStep("dong");
  }

  // 많이 줌아웃해서(GU_DONG_SWITCH_LEVEL 이상) 동 레벨을 접어야 할 때: 지도는 그대로 두고
  // (사용자가 방금 손으로 줌아웃한 상태) 오버레이 표시와 화면 상태만 구 레벨로 되돌린다.
  function collapseToGu() {
    const map = mapRef.current;
    if (!map) return;
    clearOverlays(sourceOverlaysRef);
    clearOverlays(storeOverlaysRef);
    clearOverlays(dongContentOverlaysRef);
    if (sourceMarkerRef.current) {
      sourceMarkerRef.current.setMap(null);
      sourceMarkerRef.current = null;
    }
    setSource(null);
    setQuery("");
    setRadiusKey("dong");
    setSelected(null);
    setSelectedDongName(null);
    setSelectedGuName(null);
    setStep("gu");
    setOverlaysVisible(dongPolygonsRef, null);
    setOverlaysVisible(dongLabelsRef, null);
    setOverlaysVisible(guPolygonsRef, map);
    setOverlaysVisible(guLabelsRef, map);
  }

  // 선택된 동이 바뀌면 폴리곤/라벨 스타일만 갱신(재생성하지 않음 — 경계선은 항상 지도에 남아있음).
  useEffect(() => {
    DONG_BOUNDARIES.forEach((dong, i) => {
      const selected = dong.name === selectedDongName;
      const polygon = dongPolygonsRef.current[i];
      const label = dongLabelsRef.current[i];
      if (polygon) polygon.setOptions(dongPolygonStyle(selected));
      if (label) {
        const content = label.getContent() as HTMLElement;
        content.style.cssText = dongLabelStyle(selected);
      }
    });
  }, [selectedDongName]);

  function goToDong(dong: DongBoundary) {
    const map = mapRef.current;
    if (!map || !window.kakao) return;
    // 동 경계가 아직 없으면(예: GPS로 구 레벨에서 바로 진입) 먼저 그리고, 구는 숨기고 동만 보이게.
    ensureDongPolygonsCreated();
    setOverlaysVisible(guPolygonsRef, null);
    setOverlaysVisible(guLabelsRef, null);
    setOverlaysVisible(dongPolygonsRef, map);
    setOverlaysVisible(dongLabelsRef, map);
    setSelectedGuName(DATA_READY_GU);
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
    setSelectedDongName(dong.name);
    flyTo(map, dong.center, DONG_LEVEL);
    renderDongContent(dong);
    if (dong.name === DATA_READY_DONG) {
      setStep("source");
      renderSourcePins();
    } else {
      setStep("empty");
    }
  }

  // 그 동의 지하철역 + 동네 사람들이 제보한 가게(둘러보기 모드, 검색 전이라 방향/거리 없음)를
  // 표시. 검색 단계(search)로 넘어가면 chooseSource 에서 지워지고 검색 결과 핀으로 대체된다.
  function renderDongContent(dong: DongBoundary) {
    const map = mapRef.current;
    if (!map || !window.kakao) return;
    const { kakao } = window;
    clearOverlays(dongContentOverlaysRef);

    for (const station of SUBWAY_STATIONS.filter((s) => s.dong === dong.name)) {
      const el = document.createElement("div");
      el.style.cssText = pinStyle({ active: true, filled: false });
      el.textContent = `🚇 ${station.name}`;
      el.addEventListener("click", () => {
        if (dong.name === DATA_READY_DONG) {
          chooseSource({ label: station.name, lat: station.lat, lng: station.lng, icon: "🚇" });
        }
      });
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(station.lat, station.lng),
        content: el,
        yAnchor: 1.6,
        zIndex: 2,
        clickable: true,
      });
      overlay.setMap(map);
      dongContentOverlaysRef.current.push(overlay);
    }

    for (const store of DEMO_STORES.filter((s) => s.dong === dong.name)) {
      const el = document.createElement("div");
      el.className = "store-pin" + (store.verified ? "" : " store-pin--gray");
      el.style.setProperty("--pin-color", store.verified ? "#3182f6" : "#9ca3af");
      const icon = document.createElement("span");
      icon.className = "store-pin__icon";
      icon.textContent = CATEGORY_ICON[store.category];
      const name = document.createElement("span");
      name.className = "store-pin__name";
      name.textContent = store.name;
      el.append(icon, name);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected({ store, matched: store.items });
      });
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(store.lat, store.lng),
        content: el,
        yAnchor: 1,
        zIndex: 4,
        clickable: true,
      });
      overlay.setMap(map);
      dongContentOverlaysRef.current.push(overlay);
    }
  }

  function renderSourcePins() {
    const map = mapRef.current;
    if (!map || !window.kakao) return;
    const { kakao } = window;
    clearOverlays(sourceOverlaysRef);
    for (const opt of SOURCE_OPTIONS) {
      const el = document.createElement("div");
      el.style.cssText = pinStyle({ active: true, filled: false });
      el.textContent = `${opt.icon ?? "🏢"} ${opt.label}`;
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
    clearOverlays(dongContentOverlaysRef); // 둘러보기 핀 정리 — 이제부터는 검색 결과 핀이 대신함
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
    collapseToGu(); // 오버레이 표시·상태를 구 레벨로 정리
    const map = mapRef.current;
    if (map && window.kakao) {
      // 동 레벨 → 구 레벨은 거리·줌 차이가 커서 flyTo(panTo+idle 대기)가 불안정했다.
      // "처음부터"는 순간 이동이어도 자연스러운 제스처라 애니메이션 없이 바로 옮긴다.
      map.setCenter(new window.kakao.maps.LatLng(GU_WIDE_CENTER.lat, GU_WIDE_CENTER.lng));
      map.setLevel(GU_LEVEL);
      map.relayout();
    }
  }

  // GPS로 내 위치를 찾아 그 위치가 속한 동을 자동 선택. 좌표는 화면 표시용일 뿐 저장하지 않음(스펙 2장).
  function locateMyDong() {
    if (!navigator.geolocation) {
      flashNotice("이 기기에서는 위치를 사용할 수 없어요.");
      return;
    }
    setLocating(true);
    flashNotice("현재 위치를 찾는 중…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const map = mapRef.current;
        if (map && window.kakao) {
          const { kakao } = window;
          const ll = new kakao.maps.LatLng(latitude, longitude);
          if (!gpsMarkerRef.current) {
            const el = document.createElement("div");
            el.className = "geo-dot";
            gpsMarkerRef.current = new kakao.maps.CustomOverlay({
              content: el,
              yAnchor: 0.5,
              zIndex: 5,
            });
          }
          gpsMarkerRef.current.setPosition(ll);
          gpsMarkerRef.current.setMap(map);
        }
        const found = findDongAt(latitude, longitude);
        if (found) {
          goToDong(found);
          flashNotice(`📍 현재 위치는 ${found.name}이에요`);
        } else {
          mapRef.current?.panTo(new window.kakao.maps.LatLng(latitude, longitude));
          flashNotice("현재 위치는 아직 지원하는 동네 밖이에요 (동대문구 일부만 지원 중).");
        }
      },
      (err) => {
        setLocating(false);
        flashNotice(
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요."
            : "현재 위치를 가져오지 못했어요.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
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
              {debugMsg && <p className="text-[10px] text-red-600">{debugMsg}</p>}
              {step === "gu" && (
                <p className="mt-0.5 text-xs text-ink-3">
                  지도에서 구를 눌러보세요 (지금은 {DATA_READY_GU}만 데이터가 있어요)
                </p>
              )}
              {step === "dong" && (
                <p className="mt-0.5 text-xs text-ink-3">
                  지도에서 동을 눌러보세요 (지금은 {DATA_READY_DONG}만 데이터가 있어요)
                </p>
              )}
              {step === "empty" && (
                <p className="mt-0.5 text-xs text-ink-3">📍 {selectedDongName} 을 선택했어요</p>
              )}
              {step === "source" && (
                <p className="mt-0.5 text-xs text-ink-3">🏢🚇 마커를 눌러 출발지를 고르거나, 주소를 입력하세요.</p>
              )}
              {step === "search" && source && (
                <p className="mt-0.5 text-xs font-semibold text-brand-ink">📍 {source.label} 기준</p>
              )}
            </div>
            {step !== "gu" && (
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

      {/* 아직 아이템 검색은 안 되는 동을 선택했을 때 — 지하철역/동네가게 핀은 지도에 떠 있음 */}
      {step === "empty" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4">
          <div className="pointer-events-auto mx-auto max-w-md rounded-card border border-line bg-surface p-3 text-center shadow-[var(--sh-2)]">
            <p className="text-xs text-ink-3">
              🚇🥬 핀을 눌러 {selectedDongName}에 있는 걸 둘러보세요. 아이템 검색은 아직{" "}
              <button
                type="button"
                className="font-bold text-brand-ink underline underline-offset-2"
                onClick={() => {
                  const imun = DONG_BOUNDARIES.find((d) => d.name === DATA_READY_DONG);
                  if (imun) goToDong(imun);
                }}
              >
                {DATA_READY_DONG}
              </button>
              에서만 돼요.
            </p>
          </div>
        </div>
      )}

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
                {selected.direction && selected.distance != null ? (
                  <p className="mt-0.5 text-xs font-semibold text-brand-ink">
                    {selected.direction}쪽 {formatDistance(selected.distance)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-ink-3">{selectedDongName} 등록 가게</p>
                )}
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

      {/* GPS 현재 위치 → 자동 동 선택 */}
      {!error && !selected && (
        <button
          type="button"
          onClick={locateMyDong}
          disabled={locating}
          aria-label="현재 위치로 동 찾기"
          className="absolute bottom-6 right-4 z-20 flex size-11 items-center justify-center rounded-full bg-white text-ink-2 shadow-md transition-colors hover:bg-surface-2 active:bg-surface-2 disabled:opacity-60"
        >
          <GpsIcon className={`size-5 ${locating ? "animate-pulse" : ""}`} />
        </button>
      )}

      {/* 토스트 안내 */}
      {notice && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-50 flex justify-center px-4">
          <div className="rounded-full bg-gray-900 px-4 py-2 text-center text-sm text-white shadow-lg">{notice}</div>
        </div>
      )}
    </div>
  );
}
