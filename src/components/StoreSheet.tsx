"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CATEGORY_META } from "@/lib/constants";
import {
  DAY_KEYS,
  DAY_LABELS,
  formatDayHours,
  getKstNow,
  type DayKey,
} from "@/lib/businessHours";
import { freshnessLabel, reviewDateLabel, starString, untilLabel, won } from "@/lib/format";
import { haversineMeters, formatDistance } from "@/lib/geo";
import { GpsIcon } from "./GpsIcon";
import { track } from "@/lib/track";
import type { StoreDetailDTO } from "@/lib/types";

/** 사장님 노출 리포트(M0) — 오늘/최근7일 집계. */
type StoreStats = {
  today: Record<string, number>;
  last7: Record<string, number>;
};
import { SaleReportForm } from "./SaleReportForm";
import { ClosureReportForm } from "./ClosureReportForm";
import { ReviewForm } from "./ReviewForm";
import { ReportButton } from "./ReportButton";
import { ReviewContent } from "./ReviewContent";
import { PriceChart } from "./PriceChart";
import { MerchantApply } from "./MerchantApply";
import { ProductForm } from "./ProductForm";
import { PhotoEditor } from "./PhotoEditor";
import { ShareButton } from "./ShareButton";
import type { ProductDTO, ReviewDTO } from "@/lib/types";

type Composing = "sale" | "review" | null;

type TabKey = "products" | "sales" | "notice" | "reviews";

const TABS: { key: TabKey; label: string }[] = [
  { key: "products", label: "메뉴" },
  { key: "sales", label: "세일/행사" },
  { key: "notice", label: "공지" },
  { key: "reviews", label: "리뷰" },
];

/**
 * 가게 상세 바텀시트 (스펙 Phase 2).
 * - peek(절반) ↔ full(전체화면) 드래그 스냅, 아래로 끌면 닫힘.
 * - 탭: 상품 / 세일 / 공지 / 리뷰
 * - 헤더: 영업중 자동판정 배지 + 즐겨찾기 토글
 */
export function StoreSheet({
  storeId,
  onClose,
  onToast,
  userLoc,
  onLocate,
}: {
  storeId: string | null;
  onClose: () => void;
  onToast: (msg: string) => void;
  userLoc?: { lat: number; lng: number } | null;
  onLocate?: () => void;
}) {
  const [detail, setDetail] = useState<StoreDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>("sales");
  const [favorite, setFavorite] = useState(false);
  const [composing, setComposing] = useState<Composing>(null);
  const [bannerEditFile, setBannerEditFile] = useState<File | null>(null);
  const [closureForm, setClosureForm] = useState(false);
  const [productAddRequested, setProductAddRequested] = useState(false);
  const [stats, setStats] = useState<StoreStats | null>(null); // 사장님 노출 리포트(M0)

  // 태블릿/PC(>=768px)에서는 왼쪽 사이드 패널, 모바일에서는 하단 바텀시트
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // 시트 세로 위치(px). 작을수록 위로 펼쳐짐. (모바일 바텀시트 전용)
  const [translateY, setTranslateY] = useState(0);
  const vhRef = useRef(0);
  const dragRef = useRef<{ startY: number; startT: number } | null>(null);

  const snapPoints = useCallback(() => {
    const vh = vhRef.current || (typeof window !== "undefined" ? window.innerHeight : 800);
    return { full: Math.round(vh * 0.08), peek: Math.round(vh * 0.52), closed: vh };
  }, []);

  const loadDetail = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stores/${id}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as StoreDetailDTO;
        setDetail(data);
        setFavorite(data.isFavorite);
      } catch {
        onToast("상세 정보를 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    },
    [onToast],
  );

  // 가게 변경 시 상세 로드 + peek 으로 열기
  useEffect(() => {
    if (!storeId) return;
    vhRef.current = window.innerHeight;
    setDetail(null);
    setStats(null);
    setTab("sales");
    setComposing(null);
    setClosureForm(false);
    setTranslateY(snapPoints().peek);
    loadDetail(storeId);
    track({ storeId, type: "detail_open", source: "detail" }); // M0: 상세 열람 집계
  }, [storeId, snapPoints, loadDetail]);

  // M0: 사장님/관리자면 노출 리포트 로드
  useEffect(() => {
    if (!storeId || !detail?.canManageStore) {
      setStats(null);
      return;
    }
    let active = true;
    fetch(`/api/stores/${storeId}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: StoreStats | null) => {
        if (active) setStats(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [storeId, detail?.canManageStore]);

  const refresh = useCallback(() => {
    setComposing(null);
    if (storeId) loadDetail(storeId);
  }, [storeId, loadDetail]);

  // 배너(메인 사진) 관리 — 소유자/관리자만 (서버에서 403 가드)
  const bannerRef = useRef<HTMLInputElement>(null);
  const uploadBanner = useCallback(
    async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (!up.ok) {
        onToast(up.status === 401 ? "로그인이 필요해요." : "사진 업로드 실패");
        return;
      }
      const { url } = (await up.json()) as { url: string };
      const res = await fetch(`/api/stores/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerUrl: url }),
      });
      if (res.ok) {
        onToast("메인 사진을 등록했어요.");
        refresh();
      } else {
        onToast(res.status === 403 ? "사장님·관리자만 가능해요." : "변경에 실패했어요.");
      }
    },
    [storeId, onToast, refresh],
  );
  const removeBanner = useCallback(async () => {
    const res = await fetch(`/api/stores/${storeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bannerUrl: null }),
    });
    if (res.ok) {
      onToast("메인 사진을 삭제했어요.");
      refresh();
    } else {
      onToast("변경에 실패했어요.");
    }
  }, [storeId, onToast, refresh]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (isDesktop) return; // 데스크톱은 고정 사이드 패널 — 드래그 없음
    dragRef.current = { startY: e.clientY, startT: translateY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { full, closed } = snapPoints();
    const next = Math.min(closed, Math.max(full, drag.startT + (e.clientY - drag.startY)));
    setTranslateY(next);
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const { full, peek } = snapPoints();
    // 아래로 충분히 내리면 닫기
    if (translateY > peek + 120) {
      onClose();
      return;
    }
    // 가까운 스냅 지점으로
    setTranslateY(translateY < (full + peek) / 2 ? full : peek);
  };

  if (!storeId) return null;

  const { full, peek } = snapPoints();
  const openRatio =
    peek > full ? 1 - (translateY - full) / (peek - full) : 0; // 0(peek)~1(full)
  const backdropOpacity = Math.min(0.4, Math.max(0, openRatio) * 0.4);

  const meta = detail ? CATEGORY_META[detail.category] : null;

  return (
    <div className="absolute inset-0 z-40 md:pointer-events-none">
      {/* 백드롭 (탭하면 닫힘) — 데스크톱 사이드 패널에서는 지도를 가리지 않도록 숨김 */}
      <div
        className="absolute inset-0 bg-black transition-opacity md:hidden"
        style={{ opacity: backdropOpacity }}
        onClick={onClose}
      />

      {/* 시트: 모바일=하단 바텀시트(드래그) / 데스크톱=왼쪽 전체높이 사이드 패널 */}
      <div
        className="absolute inset-x-0 top-0 flex h-full touch-none flex-col rounded-t-2xl bg-white shadow-2xl will-change-transform md:pointer-events-auto md:inset-x-auto md:left-0 md:w-[400px] md:max-w-[88vw] md:touch-auto md:rounded-t-none md:rounded-r-2xl"
        style={{
          transform: isDesktop ? undefined : `translateY(${translateY}px)`,
          transition: dragRef.current ? "none" : "transform 0.25s ease-out",
        }}
      >
        {/* 데스크톱 전용 닫기 버튼 (모바일은 아래로 드래그해 닫음) */}
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute left-3 top-3 z-20 hidden size-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow md:flex"
        >
          ✕
        </button>

        {/* 드래그 핸들 + 헤더 */}
        <div
          className="shrink-0 cursor-grab touch-none rounded-t-2xl px-4 pt-2 pb-3 active:cursor-grabbing md:cursor-default md:touch-auto"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300 md:hidden" />

          {detail ? (
            <>
            <div className="zoomable relative -mx-4 mb-2">
              {detail.bannerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.bannerUrl} alt="" className="h-44 w-full object-cover" />
                ) : detail.canManageStore ? (
                  <button
                    type="button"
                    onClick={() => bannerRef.current?.click()}
                    className="flex h-24 w-full items-center justify-center bg-gray-100 text-sm text-gray-400"
                  >
                    ＋ 메인 사진 추가 (사장님·관리자)
                  </button>
                ) : (
                  // 배너 없는 소비자 화면 → 카테고리 기본 배너
                  <div
                    className="flex h-44 w-full items-center justify-center"
                    style={{
                      background: meta
                        ? `linear-gradient(135deg, ${meta.color}22, ${meta.color}66)`
                        : "#f3f4f6",
                    }}
                  >
                    <span className="text-5xl opacity-50">{meta?.icon ?? "🛒"}</span>
                  </div>
                )}
                {detail.canManageStore && detail.bannerUrl && (
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => bannerRef.current?.click()}
                      className="rounded bg-black/60 px-2 py-1 text-xs text-white"
                    >
                      변경
                    </button>
                    <button
                      type="button"
                      onClick={removeBanner}
                      className="rounded bg-black/60 px-2 py-1 text-xs text-white"
                    >
                      삭제
                    </button>
                  </div>
                )}
                <input
                  ref={bannerRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setBannerEditFile(f); // 편집 후 업로드
                    e.target.value = "";
                  }}
                />
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden>
                {meta?.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-bold">{detail.name}</h2>
                  {/* '사장님 가게'는 인증된 소유자(ownerId) 유무로 판정 — source(등록 출처)만으로는
                      소유자 없는 상태와 어긋나므로(상품 탭 "사장님 미등록"과 모순) hasOwner 기준으로 통일 */}
                  {detail.hasOwner ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      👑 사장님 직접 관리
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      주민들이 관리
                    </span>
                  )}
                  {!detail.verified && (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      인증중
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <OpenBadge isOpen={detail.isOpenNow} />
                  {userLoc ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-600">
                      <GpsIcon className="size-3" /> 내 위치에서 {formatDistance(haversineMeters(userLoc.lat, userLoc.lng, detail.lat, detail.lng))}
                    </span>
                  ) : (
                    onLocate && (
                      <button
                        type="button"
                        onClick={onLocate}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-500 hover:bg-gray-200"
                      >
                        <GpsIcon className="size-3" /> 거리 보기
                      </button>
                    )
                  )}
                  {detail.avgRating !== null && (
                    <span className="text-amber-500">
                      ★ {detail.avgRating}{" "}
                      <span className="text-gray-400">({detail.reviewCount})</span>
                    </span>
                  )}
                  <span className="truncate text-gray-400">{detail.address}</span>
                  <a
                    href={`https://map.kakao.com/link/to/${encodeURIComponent(detail.name)},${detail.lat},${detail.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track({ storeId: detail.id, type: "directions_click", source: "detail" })}
                    className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-600 hover:bg-blue-100"
                  >
                    🧭 길찾기
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      track({ storeId: detail.id, type: "intent_visit", source: "detail" });
                      onToast("사장님께 방문 의향이 전달됐어요 👍");
                    }}
                    className="rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700 hover:bg-green-100"
                  >
                    🏃 갈래요
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  <Avatar img={detail.registeredBy.img} />
                  <span className="text-gray-500">{detail.registeredBy.nickname}님이 등록</span>
                </div>
              </div>
              <ShareButton
                path={`/s/${detail.id}`}
                title={`${detail.name} 세일 정보`}
                text="동네 세일 지도에서 확인해보세요!"
                onShared={() => track({ storeId: detail.id, type: "share", source: "detail" })}
                className="shrink-0 self-start rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-500"
              >
                🔗 공유
              </ShareButton>
              <button
                type="button"
                aria-label="즐겨찾기"
                onClick={async () => {
                  const next = !favorite;
                  setFavorite(next); // 낙관적 토글
                  const res = await fetch("/api/favorites", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ storeId: detail.id, on: next }),
                  });
                  if (!res.ok) {
                    setFavorite(!next); // 롤백
                    onToast(
                      res.status === 401
                        ? "로그인이 필요해요 (로그인 연결은 이후 Phase)."
                        : "즐겨찾기는 곧 제공돼요.",
                    );
                  } else if (next) {
                    track({ storeId: detail.id, type: "favorite", source: "detail" }); // M0
                  }
                }}
                className="shrink-0 text-2xl leading-none"
              >
                <span className={favorite ? "text-red-500" : "text-gray-300"}>
                  {favorite ? "♥" : "♡"}
                </span>
              </button>
            </div>
            </>
          ) : (
            <div className="h-12 animate-pulse rounded bg-gray-100" />
          )}

          {/* 탭 */}
          <div className="mt-3 flex border-b border-gray-100">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setComposing(null);
                }}
                className={[
                  "flex-1 border-b-2 pb-2 text-sm font-medium transition",
                  tab === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-400",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 내용 (스크롤) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {/* 사장님 노출 리포트(M0) — owner/admin 전용 */}
          {detail?.canManageStore && stats && (
            <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              <p className="text-xs font-semibold text-blue-700">📊 우리 가게 반응 (사장님 전용)</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["노출", "impressions"],
                    ["상세열람", "detailOpens"],
                    ["길찾기", "directionsClicks"],
                    ["즐겨찾기", "favorites"],
                    ["공유", "shares"],
                    ["방문의향", "intentVisits"],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className="rounded-lg bg-white px-1.5 py-1.5 text-center">
                    <p className="text-[11px] text-gray-400">{label}</p>
                    <p className="text-base font-bold text-gray-800">{stats.today[key] ?? 0}</p>
                    <p className="text-[10px] text-gray-400">7일 {stats.last7[key] ?? 0}</p>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-gray-400">오늘(큰 숫자) · 최근 7일 합계</p>
            </div>
          )}
          {detail && (
            <div className="mb-3">
              {closureForm ? (
                <ClosureReportForm
                  storeId={detail.id}
                  onToast={onToast}
                  onCancel={() => setClosureForm(false)}
                  onDone={() => {
                    setClosureForm(false);
                    refresh();
                  }}
                />
              ) : (
                <ClosureBanner detail={detail} onReport={() => setClosureForm(true)} />
              )}
            </div>
          )}
          {loading || !detail ? (
            <p className="py-10 text-center text-sm text-gray-400">불러오는 중…</p>
          ) : tab === "products" ? (
            <ProductsTab
              detail={detail}
              onToast={onToast}
              onDone={refresh}
              requestAdd={productAddRequested}
              onAddHandled={() => setProductAddRequested(false)}
            />
          ) : tab === "sales" ? (
            <SalesTab
              detail={detail}
              composing={composing === "sale"}
              onCompose={() => setComposing("sale")}
              onClose={() => setComposing(null)}
              onDone={refresh}
              onToast={onToast}
            />
          ) : tab === "notice" ? (
            <NoticeTab detail={detail} onToast={onToast} onClose={onClose} onDone={refresh} />
          ) : (
            <ReviewsTab
              detail={detail}
              composing={composing === "review"}
              onCompose={() => setComposing("review")}
              onClose={() => setComposing(null)}
              onDone={refresh}
              onToast={onToast}
              onGoRegisterProduct={() => {
                setComposing(null);
                setTab("products");
                setProductAddRequested(true);
              }}
            />
          )}
        </div>
      </div>

      {bannerEditFile && (
        <PhotoEditor
          file={bannerEditFile}
          onSave={(f) => {
            setBannerEditFile(null);
            uploadBanner(f);
          }}
          onCancel={() => setBannerEditFile(null)}
        />
      )}
    </div>
  );
}

/** 휴업/폐업 제보 경고 배너 + 제보 진입 버튼. */
function ClosureBanner({
  detail,
  onReport,
}: {
  detail: StoreDetailDTO;
  onReport: () => void;
}) {
  const reports = detail.closureReports ?? [];
  const shutdown = reports.filter((r) => r.kind === "shutdown");
  const today = reports.filter((r) => r.kind === "closed_today");
  const has = reports.length > 0;

  // 제보가 없으면 공간을 적게 차지하는 작은 링크만 노출
  if (!has) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onReport}
          className="text-xs text-gray-400 underline-offset-2 hover:text-amber-600 hover:underline"
        >
          🚪 휴업/폐업 제보
        </button>
      </div>
    );
  }

  return (
    <div
      className={[
        "rounded-xl border p-3",
        shutdown.length > 0 ? "border-gray-800 bg-gray-100" : "border-amber-300 bg-amber-50",
      ].join(" ")}
    >
      <p className="text-sm font-semibold">
        {shutdown.length > 0 ? "🚫 폐업 제보가 있어요" : "⚠️ 오늘 휴업 제보가 있어요"}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        {shutdown.length > 0 && `폐업 제보 ${shutdown.length}건`}
        {shutdown.length > 0 && today.length > 0 && " · "}
        {today.length > 0 && `오늘 휴업 제보 ${today.length}건`} · 이웃 제보(미확정)
      </p>
      {/* 최근 제보 사진 */}
      {reports.some((r) => r.photoUrl) && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {reports
            .filter((r) => r.photoUrl)
            .slice(0, 5)
            .map((r) => (
              <div key={r.id} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photoUrl ?? ""} alt="" className="size-16 rounded-lg object-cover" />
                <p className="mt-0.5 w-16 truncate text-[10px] text-gray-400">{r.nickname}</p>
              </div>
            ))}
        </div>
      )}
      {reports.find((r) => r.note) && (
        <p className="mt-1 text-xs text-gray-600">“{reports.find((r) => r.note)?.note}”</p>
      )}
      <button
        type="button"
        onClick={onReport}
        className="mt-2 w-full rounded-lg bg-amber-600 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        🚪 휴업/폐업 제보하기
      </button>
    </div>
  );
}

function OpenBadge({ isOpen }: { isOpen: boolean | null }) {
  if (isOpen === null) {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">영업정보 없음</span>;
  }
  return isOpen ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
      영업중
    </span>
  ) : (
    <span className="rounded-full bg-gray-200 px-2 py-0.5 font-medium text-gray-600">
      영업종료
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-gray-400">{children}</p>;
}

function ProductsTab({
  detail,
  onToast,
  onDone,
  requestAdd = false,
  onAddHandled,
}: {
  detail: StoreDetailDTO;
  onToast: (msg: string) => void;
  onDone: () => void;
  requestAdd?: boolean;
  onAddHandled?: () => void;
}) {
  const [composing, setComposing] = useState<{ mode: "add" } | { mode: "edit"; product: ProductDTO } | null>(
    null,
  );

  // 리뷰 흐름에서 '상품 등록하러 가기'로 진입하면 추가 폼을 자동으로 연다.
  useEffect(() => {
    if (requestAdd) {
      setComposing(detail.canManageMenu ? { mode: "add" } : null);
      if (!detail.canManageMenu) onToast("이 가게는 사장님만 메뉴를 등록할 수 있어요.");
      onAddHandled?.();
    }
  }, [requestAdd, detail.canManageMenu, onAddHandled, onToast]);

  const remove = async (id: string) => {
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      onToast("메뉴를 삭제했어요.");
      onDone();
    } else {
      onToast(res.status === 403 ? "권한이 없어요." : "삭제에 실패했어요.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {detail.canManageMenu &&
        (composing ? (
          <ProductForm
            storeId={detail.id}
            category={detail.category}
            product={composing.mode === "edit" ? composing.product : undefined}
            onDone={() => {
              setComposing(null);
              onDone();
            }}
            onCancel={() => setComposing(null)}
            onToast={onToast}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposing({ mode: "add" })}
            className="rounded-lg border border-blue-600 py-2 text-sm font-medium text-blue-600"
          >
            ＋ 메뉴 추가
          </button>
        ))}

      {!detail.hasOwner && (
        <p className="text-xs text-gray-400">
          사장님 미등록 가게예요. 이웃 누구나 메뉴를 등록·수정할 수 있어요.
        </p>
      )}

      {detail.products.length === 0 ? (
        <EmptyState>아직 등록된 메뉴가 없어요.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {detail.products.map((p) => (
            <li key={p.id} className="flex gap-3">
              <Thumb url={p.photoUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="shrink-0 font-bold">{won(p.price)}</p>
                </div>
                {(() => {
                  const meta = [
                    p.qtyUnit,
                    p.origin,
                    p.stock !== null ? `재고 ${p.stock}` : null,
                  ]
                    .filter((x) => x && String(x).trim())
                    .join(" · ");
                  return meta ? <p className="text-xs text-gray-500">{meta}</p> : null;
                })()}
                <div className="mt-1 flex items-center gap-1.5">
                  <Avatar img={p.contributorImg} />
                  <span className="text-xs text-gray-500">{p.contributorNickname}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{freshnessLabel(p.updatedAt)}</span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  {detail.canManageMenu && (
                    <>
                      <button
                        type="button"
                        onClick={() => setComposing({ mode: "edit", product: p })}
                        className="text-xs text-blue-600"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="text-xs text-red-500"
                      >
                        삭제
                      </button>
                    </>
                  )}
                  <ReportButton
                    targetType="product"
                    targetId={p.id}
                    onToast={onToast}
                    onChanged={onDone}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Avatar({ img }: { img: string | null }) {
  return (
    <span className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-[10px]">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="size-full object-cover" />
      ) : (
        "🙂"
      )}
    </span>
  );
}

function SalesTab({
  detail,
  composing,
  onCompose,
  onClose,
  onDone,
  onToast,
}: {
  detail: StoreDetailDTO;
  composing: boolean;
  onCompose: () => void;
  onClose: () => void;
  onDone: () => void;
  onToast: (msg: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {composing ? (
        <SaleReportForm
          storeId={detail.id}
          category={detail.category}
          products={detail.products}
          onDone={onDone}
          onCancel={onClose}
          onToast={onToast}
        />
      ) : (
        <button
          type="button"
          onClick={onCompose}
          className="rounded-lg border border-blue-600 py-2 text-sm font-medium text-blue-600"
        >
          🔥 세일 제보하기
        </button>
      )}

      {detail.priceTrends.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">📈 가격 추이 <span className="font-normal text-gray-400">(최근 90일 세일가)</span></h3>
          {detail.priceTrends.map((t) => (
            <PriceChart key={t.key} trend={t} />
          ))}
        </section>
      )}

      {detail.sales.length === 0 ? (
        <EmptyState>지금 진행중인 세일이 없어요. 첫 제보를 남겨보세요!</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {detail.sales.map((s) => (
        <li key={s.id} className="overflow-hidden rounded-xl border border-gray-100">
          <PhotoCarousel urls={s.photoUrls?.length ? s.photoUrls : s.photoUrl ? [s.photoUrl] : []} />
          <div className="p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-medium">{s.title}</p>
              <p className="shrink-0 font-bold text-red-600">{won(s.salePrice)}</p>
            </div>
            {s.qty?.trim() && <p className="text-xs text-gray-500">{s.qty}</p>}
            <div className="mt-0.5 flex items-center gap-2 text-xs">
              <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600">
                {untilLabel(s.expiresAt)}
              </span>
              <span className="text-gray-400">{freshnessLabel(s.createdAt)}</span>
              {s.isMine && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`/api/sales/${s.id}`, { method: "DELETE" });
                    if (res.ok) {
                      onToast("삭제했어요. 적립 포인트가 회수됐어요.");
                      onDone();
                    } else {
                      onToast(res.status === 403 ? "권한이 없어요." : "삭제에 실패했어요.");
                    }
                  }}
                  className="text-xs text-red-500"
                >
                  삭제
                </button>
              )}
              <ReportButton
                targetType="sale"
                targetId={s.id}
                onToast={onToast}
                onChanged={onDone}
              />
            </div>
          </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 가게 정보 PATCH 공통 헬퍼. 성공 시 onDone, 실패 시 사유 토스트. */
async function patchStore(
  id: string,
  body: Record<string, unknown>,
  onToast: (m: string) => void,
  onDone: () => void,
  okMsg: string,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/stores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      onToast(okMsg);
      onDone();
      return true;
    }
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    onToast(
      res.status === 403
        ? "사장님·관리자만 가능해요."
        : res.status === 401
          ? "로그인이 필요해요."
          : e.error ?? "저장에 실패했어요.",
    );
    return false;
  } catch {
    onToast("네트워크 오류가 발생했어요.");
    return false;
  }
}

/** 섹션 제목 + (권한 있을 때) 수정 버튼. */
function SectionHead({
  title,
  canEdit,
  editing,
  onEdit,
  emoji,
}: {
  title: string;
  canEdit: boolean;
  editing: boolean;
  onEdit: () => void;
  emoji?: string;
}) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <h3 className="flex items-center gap-1 font-semibold">
        {emoji ? `${emoji} ` : ""}
        {title}
      </h3>
      {canEdit && !editing && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          수정
        </button>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500";

/** 가게 소개(description) — 소유자/관리자만 편집. */
function IntroSection({
  detail,
  onToast,
  onDone,
}: {
  detail: StoreDetailDTO;
  onToast: (m: string) => void;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(detail.description ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <section>
      <SectionHead
        title="가게 소개"
        canEdit={detail.canManageStore}
        editing={editing}
        onEdit={() => {
          setText(detail.description ?? "");
          setEditing(true);
        }}
      />
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            placeholder="가게를 소개하는 글을 적어 주세요."
            className={`${inputCls} resize-none`}
          />
          <SaveCancel
            busy={busy}
            onCancel={() => setEditing(false)}
            onSave={async () => {
              setBusy(true);
              const ok = await patchStore(detail.id, { description: text }, onToast, onDone, "소개를 저장했어요.");
              setBusy(false);
              if (ok) setEditing(false);
            }}
          />
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-gray-600">
          {detail.description?.trim() || "아직 등록된 소개가 없어요."}
        </p>
      )}
    </section>
  );
}

/** 기본 정보(주소/전화) — 소유자/관리자만 편집. */
function BasicInfoSection({
  detail,
  onToast,
  onDone,
}: {
  detail: StoreDetailDTO;
  onToast: (m: string) => void;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(detail.address);
  const [phone, setPhone] = useState(detail.phone ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <section>
      <SectionHead
        title="기본 정보"
        canEdit={detail.canManageStore}
        editing={editing}
        onEdit={() => {
          setAddress(detail.address);
          setPhone(detail.phone ?? "");
          setEditing(true);
        }}
      />
      {editing ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400">주소</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
          <label className="text-xs text-gray-400">전화번호 (선택)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="없으면 비워 두세요"
            className={inputCls}
          />
          <SaveCancel
            busy={busy}
            onCancel={() => setEditing(false)}
            onSave={async () => {
              if (!address.trim()) return onToast("주소를 입력해 주세요.");
              setBusy(true);
              const ok = await patchStore(detail.id, { address, phone }, onToast, onDone, "기본 정보를 저장했어요.");
              setBusy(false);
              if (ok) setEditing(false);
            }}
          />
        </div>
      ) : (
        <dl className="flex flex-col gap-1 text-gray-600">
          <div className="flex gap-2">
            <dt className="w-12 shrink-0 text-gray-400">주소</dt>
            <dd>{detail.address}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-12 shrink-0 text-gray-400">전화</dt>
            <dd>{detail.phone ?? "정보 없음"}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

type DayDraft = { open: string; close: string; closed: boolean };

/** 영업시간(hoursJson) — 소유자/관리자만 편집(요일별 휴무/시간). */
function HoursSection({
  detail,
  onToast,
  onDone,
}: {
  detail: StoreDetailDTO;
  onToast: (m: string) => void;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const initDraft = useCallback((): Record<DayKey, DayDraft> => {
    const out = {} as Record<DayKey, DayDraft>;
    for (const d of DAY_KEYS) {
      const h = detail.hours?.[d] ?? null;
      out[d] = h
        ? { open: h.open, close: h.close, closed: false }
        : { open: "09:00", close: "21:00", closed: true };
    }
    return out;
  }, [detail.hours]);
  const [draft, setDraft] = useState<Record<DayKey, DayDraft>>(initDraft);

  const setDay = (d: DayKey, patch: Partial<DayDraft>) =>
    setDraft((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));

  const save = async () => {
    const hours: Record<string, { open: string; close: string } | null> = {};
    for (const d of DAY_KEYS) {
      const v = draft[d];
      hours[d] = v.closed ? null : { open: v.open, close: v.close };
    }
    setBusy(true);
    const ok = await patchStore(detail.id, { hoursJson: hours }, onToast, onDone, "영업시간을 저장했어요.");
    setBusy(false);
    if (ok) setEditing(false);
  };

  return (
    <section>
      <SectionHead
        title="영업시간"
        canEdit={detail.canManageStore}
        editing={editing}
        onEdit={() => {
          setDraft(initDraft());
          setEditing(true);
        }}
      />
      {editing ? (
        <div className="flex flex-col gap-2">
          {DAY_KEYS.map((d) => {
            const v = draft[d];
            return (
              <div key={d} className="flex items-center gap-2 text-sm">
                <span className="w-6 shrink-0 font-medium">{DAY_LABELS[d]}</span>
                {v.closed ? (
                  <span className="flex-1 text-gray-400">휴무</span>
                ) : (
                  <span className="flex flex-1 items-center gap-1">
                    <input
                      type="time"
                      value={v.open}
                      onChange={(e) => setDay(d, { open: e.target.value })}
                      className="rounded border border-gray-200 px-2 py-1"
                    />
                    <span className="text-gray-400">–</span>
                    <input
                      type="time"
                      value={v.close}
                      onChange={(e) => setDay(d, { close: e.target.value })}
                      className="rounded border border-gray-200 px-2 py-1"
                    />
                  </span>
                )}
                <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={v.closed}
                    onChange={(e) => setDay(d, { closed: e.target.checked })}
                  />
                  휴무
                </label>
              </div>
            );
          })}
          <SaveCancel busy={busy} onCancel={() => setEditing(false)} onSave={save} />
        </div>
      ) : detail.hours ? (
        <ul className="flex flex-col gap-0.5 text-gray-600">
          {DAY_KEYS.map((d) => {
            const today = getKstNow().dayKey === d;
            return (
              <li
                key={d}
                className={`flex justify-between ${today ? "font-semibold text-gray-900" : ""}`}
              >
                <span>{DAY_LABELS[d]}</span>
                <span>{formatDayHours(detail.hours?.[d] ?? null)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-gray-400">영업시간 정보가 없어요.</p>
      )}
    </section>
  );
}

/** 저장/취소 버튼 묶음. */
function SaveCancel({
  busy,
  onSave,
  onCancel,
}: {
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
      >
        {busy ? "저장 중…" : "저장"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50"
      >
        취소
      </button>
    </div>
  );
}

/**
 * 가게 공지사항 — 사장님/관리자(canManageStore)만 추가·수정·삭제, 소비자는 조회만.
 */
function NoticeSection({
  detail,
  onToast,
  onDone,
}: {
  detail: StoreDetailDTO;
  onToast: (msg: string) => void;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(detail.notice ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (value: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/stores/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notice: value }),
      });
      if (res.ok) {
        onToast(value.trim() ? "공지를 저장했어요." : "공지를 삭제했어요.");
        setEditing(false);
        onDone();
      } else {
        onToast(res.status === 403 ? "사장님·관리자만 가능해요." : "저장에 실패했어요.");
      }
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  // 소비자(권한 없음): 공지가 있을 때만 표시
  if (!detail.canManageStore) {
    if (!detail.notice?.trim()) return null;
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <h3 className="mb-1 flex items-center gap-1 font-semibold text-amber-800">📢 공지사항</h3>
        <p className="whitespace-pre-wrap text-amber-900">{detail.notice}</p>
      </section>
    );
  }

  // 사장님/관리자: 편집 가능
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-1 font-semibold text-amber-800">📢 공지사항</h3>
        {!editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setText(detail.notice ?? "");
                setEditing(true);
              }}
              className="text-xs font-medium text-amber-700"
            >
              {detail.notice?.trim() ? "수정" : "＋ 추가"}
            </button>
            {detail.notice?.trim() && (
              <button
                type="button"
                onClick={() => save("")}
                disabled={busy}
                className="text-xs text-red-500 disabled:text-gray-300"
              >
                삭제
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            placeholder="예: 오늘 신선한 딸기 입고했어요! 매주 화요일 휴무"
            className="w-full resize-none rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => save(text)}
              disabled={busy || !text.trim()}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
            >
              {busy ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-gray-500"
            >
              취소
            </button>
          </div>
        </div>
      ) : detail.notice?.trim() ? (
        <p className="whitespace-pre-wrap text-amber-900">{detail.notice}</p>
      ) : (
        <p className="text-xs text-amber-700/70">아직 등록된 공지가 없어요. 손님에게 알릴 내용을 추가해 보세요.</p>
      )}
    </section>
  );
}

function NoticeTab({
  detail,
  onToast,
  onClose,
  onDone,
}: {
  detail: StoreDetailDTO;
  onToast: (msg: string) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <NoticeSection detail={detail} onToast={onToast} onDone={onDone} />
      <IntroSection detail={detail} onToast={onToast} onDone={onDone} />
      <BasicInfoSection detail={detail} onToast={onToast} onDone={onDone} />
      <HoursSection detail={detail} onToast={onToast} onDone={onDone} />

      <section className="border-t border-gray-100 pt-3">
        <MerchantApply
          storeId={detail.id}
          hasOwner={detail.hasOwner}
          isOwner={detail.isOwner}
          onToast={onToast}
        />
      </section>

      <section className="border-t border-gray-100 pt-3">
        <span className="text-gray-400">잘못된 가게 정보인가요? </span>
        <ReportButton
          targetType="store"
          targetId={detail.id}
          onToast={onToast}
          onChanged={onClose}
          label="가게 신고"
        />
      </section>
    </div>
  );
}

function ReviewsTab({
  detail,
  composing,
  onCompose,
  onClose,
  onDone,
  onToast,
  onGoRegisterProduct,
}: {
  detail: StoreDetailDTO;
  composing: boolean;
  onCompose: () => void;
  onClose: () => void;
  onDone: () => void;
  onToast: (msg: string) => void;
  onGoRegisterProduct: () => void;
}) {
  // 내 리뷰 수정 — 특정 리뷰를 편집 중일 때 폼을 인라인으로 연다.
  const [editReview, setEditReview] = useState<ReviewDTO | null>(null);

  const remove = async (id: string) => {
    const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    if (res.ok) {
      onToast("리뷰를 삭제했어요.");
      onDone();
    } else {
      onToast(res.status === 403 ? "권한이 없어요." : "삭제에 실패했어요.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {composing ? (
        <ReviewForm
          storeId={detail.id}
          products={detail.products}
          onGoRegisterProduct={onGoRegisterProduct}
          onDone={onDone}
          onCancel={onClose}
          onToast={onToast}
        />
      ) : editReview ? (
        <ReviewForm
          storeId={detail.id}
          products={detail.products}
          review={editReview}
          onDone={() => {
            setEditReview(null);
            onDone();
          }}
          onCancel={() => setEditReview(null)}
          onToast={onToast}
        />
      ) : (
        <button
          type="button"
          onClick={onCompose}
          className="rounded-lg border border-blue-600 py-2 text-sm font-medium text-blue-600"
        >
          ✍️ 리뷰 쓰기
        </button>
      )}

      {detail.avgRating !== null && (
        <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
          <span className="text-2xl font-bold">{detail.avgRating}</span>
          <span className="text-amber-500">{starString(detail.avgRating)}</span>
          <span className="text-xs text-gray-400">리뷰 {detail.reviewCount}개</span>
        </div>
      )}
      {detail.reviews.length === 0 ? (
        <EmptyState>아직 리뷰가 없어요. 첫 리뷰를 남겨보세요!</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {detail.reviews.map((r) => (
            <li key={r.id} className="border-b border-gray-50 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{r.nickname}</span>
                  <span className="text-xs text-gray-400">{reviewDateLabel(r.createdAt)}</span>
                </div>
                <span className="text-amber-500 text-sm">{starString(r.rating)}</span>
              </div>
              <ReviewContent
                tags={r.tags}
                content={r.content}
                products={r.products}
                verified={r.photoUrls?.length > 0}
                receiptVerified={r.receiptVerified}
              />
              {r.photoUrls?.length > 0 && (
                <div className="mt-1.5 flex gap-1.5 overflow-x-auto">
                  {r.photoUrls.map((u, i) => (
                    <div key={i} className="zoomable size-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="size-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-gray-300">
                  {!r.scored && "별점·포인트 미반영"}
                </span>
                <div className="flex items-center gap-3">
                  {r.isMine && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditReview(r)}
                        className="text-xs text-blue-600"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="text-xs text-red-500"
                      >
                        삭제
                      </button>
                    </>
                  )}
                  <ReportButton
                    targetType="review"
                    targetId={r.id}
                    onToast={onToast}
                    onChanged={onDone}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* TODO(phase-3): 리뷰 작성/평점 입력 */}
    </div>
  );
}

/** 세일 사진 슬라이드 (스와이프 + n/N 표시). */
function PhotoCarousel({ urls }: { urls: string[] }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  if (urls.length === 0) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-gray-100 text-3xl text-gray-300">
        🧺
      </div>
    );
  }
  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={() => {
          const el = ref.current;
          if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={u}
            alt=""
            className="aspect-video w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {urls.length > 1 && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {idx + 1}/{urls.length}
        </div>
      )}
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <div className="zoomable size-16 shrink-0 rounded-lg bg-gray-100">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-gray-300">🧺</div>
      )}
    </div>
  );
}
