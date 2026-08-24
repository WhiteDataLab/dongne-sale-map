"use client";

// TODO(out-of-scope): 이 컴포넌트는 PROJECT_SPEC.md 페이즈 순서 밖의 "낙서 컨셉" 데모다.
// 실제 카카오맵/지오코딩/DB 연동 없이 목업 데이터로 흐름만 보여준다.
// 정식 채택 시 스펙(docs/PROJECT_SPEC.md)을 먼저 갱신하고 Phase로 편입한다.

import { useMemo, useState } from "react";
import { DEFAULT_CENTER } from "@/lib/constants";

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

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function directionFrom(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Direction {
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI; // 0=북, 90=동
  const normalized = (angle + 360) % 360;
  const idx = Math.round(normalized / 45) % 8;
  return DIRECTIONS[idx];
}

function formatDistance(meters: number) {
  if (meters < 1000) return `약 ${Math.round(meters / 10) * 10}m`;
  return `약 ${(meters / 1000).toFixed(1)}km`;
}

function daysAgo(dateStr: string) {
  const diff = Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff <= 0) return "오늘 업데이트";
  return `${diff}일 전 업데이트`;
}

type Step = "map" | "source" | "search";

/** 이문동 컨셉 데모: 동 클릭 → 출발지 선택 → 검색어 → 방향/거리 기반 결과. */
export function ImunConceptDemo() {
  const [step, setStep] = useState<Step>("map");
  const [source, setSource] = useState<SourcePoint | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [query, setQuery] = useState("");
  const [radiusKey, setRadiusKey] = useState<RadiusKey>("dong");

  const radius = RADIUS_OPTIONS.find((r) => r.key === radiusKey)!;

  const results = useMemo(() => {
    if (!source || !query.trim()) return [];
    const q = query.trim();
    return DEMO_STORES.flatMap((store) => {
      const matched = store.items.filter((item) => item.name.includes(q));
      if (matched.length === 0) return [];
      const distance = haversineMeters(source, store);
      if (distance > radius.meters) return [];
      return [
        {
          store,
          matched,
          distance,
          direction: directionFrom(source, store),
        },
      ];
    }).sort((a, b) => a.distance - b.distance);
  }, [source, query, radius]);

  function chooseSource(point: SourcePoint) {
    setSource(point);
    setStep("search");
  }

  function submitCustomAddress() {
    if (!customAddress.trim()) return;
    // 데모: 직접 입력 주소는 실제 지오코딩 없이 이문동 기본 좌표를 씀.
    chooseSource({ label: customAddress.trim(), ...DEFAULT_CENTER });
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-5 pb-24">
      <header className="space-y-1">
        <h1 className="text-xl font-extrabold text-ink">우리 동네, 어디서 살까 🔍</h1>
        <p className="text-sm text-ink-3">
          동을 눌러 시작하고, 필요한 걸 검색해서 내 위치 기준 어디서 구할 수 있는지 찾아보세요.
        </p>
      </header>

      {/* 1단계: 동 선택 (블록형 미니맵) */}
      <section className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {["회기동", "청량리동", "휘경동"].map((dong) => (
            <div
              key={dong}
              className="flex h-16 items-center justify-center rounded-row border border-line bg-surface-2 text-xs font-semibold text-ink-4"
              title="아직 데이터가 없어요"
            >
              {dong}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setStep(step === "map" ? "source" : "map")}
            className={`col-span-1 flex h-20 -translate-y-2 items-center justify-center rounded-row border-2 text-sm font-extrabold shadow-[var(--sh-2)] transition ${
              step === "map"
                ? "border-brand bg-brand-wash text-brand-ink"
                : "border-brand bg-brand text-white"
            }`}
          >
            이문동
          </button>
          {["전농동", "답십리동"].map((dong) => (
            <div
              key={dong}
              className="flex h-16 items-center justify-center rounded-row border border-line bg-surface-2 text-xs font-semibold text-ink-4"
              title="아직 데이터가 없어요"
            >
              {dong}
            </div>
          ))}
        </div>
        {step === "map" && (
          <p className="text-center text-xs text-ink-3">👆 이문동을 눌러보세요 (다른 동은 아직 준비 중)</p>
        )}
      </section>

      {/* 2단계: 출발지 선택 */}
      {step !== "map" && (
        <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-[var(--sh-card)]">
          <h2 className="text-sm font-bold text-ink">어디서 출발할까요?</h2>
          {source && step === "search" ? (
            <div className="flex items-center justify-between rounded-row bg-brand-wash px-3 py-2 text-sm">
              <span className="font-semibold text-brand-ink">📍 {source.label}</span>
              <button type="button" className="btn-bare text-xs" onClick={() => setStep("source")}>
                변경
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                {SOURCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => chooseSource(opt)}
                    className="rounded-row border border-line bg-surface px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-surface-2"
                  >
                    🏢 {opt.label}
                  </button>
                ))}
              </div>
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
            </>
          )}
        </section>
      )}

      {/* 3단계: 검색 */}
      {step === "search" && source && (
        <section className="space-y-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="딸기, 장미, 두부, 휴지, 포켓몬빵…"
            className="w-full rounded-[var(--r-pill)] border border-line bg-surface px-5 py-3.5 text-base text-ink shadow-[var(--sh-1)] outline-none focus:border-brand"
          />

          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRadiusKey(r.key)}
                className={`rounded-[var(--r-pill)] border px-3 py-1.5 text-xs font-bold ${
                  radiusKey === r.key
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-ink-2"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {!query.trim() && (
            <p className="py-8 text-center text-sm text-ink-3">
              필요한 걸 검색해보세요. 아이스크림, 복숭아, 장미, 휴지, 두부, 포켓몬빵…
            </p>
          )}

          {query.trim() && results.length === 0 && (
            <div className="rounded-card border border-dashed border-line bg-surface-2 py-8 text-center text-sm text-ink-3">
              <p>&ldquo;{query}&rdquo;를 파는 곳을 {radius.label} 범위에서 못 찾았어요.</p>
              <p className="mt-1">반경을 넓혀보세요 →</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-3">
                &ldquo;{query}&rdquo; {results.length}곳 · {radius.label} 기준
              </p>
              {results.map(({ store, matched, distance, direction }) => (
                <a
                  key={store.id}
                  href={`https://map.kakao.com/link/search/${encodeURIComponent(store.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-card border border-line bg-surface p-4 shadow-[var(--sh-card)] hover:bg-surface-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="menu-ic">{CATEGORY_ICON[store.category]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-ink">{store.name}</span>
                        {store.verified ? (
                          <span className="badge badge--verify">인증</span>
                        ) : (
                          <span className="badge" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
                            미인증
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-brand-ink">
                        {direction}쪽 {formatDistance(distance)}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {matched.map((item) => (
                          <li key={item.name} className="flex items-center justify-between text-sm">
                            <span className="text-ink-2">{item.name}</span>
                            <span className="num font-bold text-ink">{item.price}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-[11px] text-ink-3">{daysAgo(matched[0].updatedAt)}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
