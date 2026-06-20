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
import Link from "next/link";
import { GpsIcon } from "./GpsIcon";
import { Countdown } from "./Countdown";
import { track } from "@/lib/track";
import type { StoreDetailDTO } from "@/lib/types";

/** 사장님 노출 리포트(M0) — 오늘/최근7일. M4 프로면 30·90일·요일별 확장. */
export type StoreStats = {
  today: Record<string, number>;
  last7: Record<string, number>;
  pro?: boolean;
  last30?: Record<string, number>;
  last90?: Record<string, number>;
  daily?: { day: string; impressions: number; detailOpens: number }[];
  weekday?: { impressions: number; detailOpens: number }[];
  // M11: 동종업종(같은 동·업종) 벤치마크. peer 0곳이면 null.
  benchmark?: {
    region: string;
    peerCount: number;
    avg: { impressions: number; detailOpens: number; intentVisits: number };
    mine: { impressions: number; detailOpens: number; intentVisits: number };
    percentile: number;
  } | null;
};
import { SaleReportForm } from "./SaleReportForm";
import { ClosureReportForm } from "./ClosureReportForm";
import { ReviewForm } from "./ReviewForm";
import { ReportButton } from "./ReportButton";
import { ReviewContent } from "./ReviewContent";
import { ReviewReplyBox } from "./ReviewReplyBox";
import { PriceChart } from "./PriceChart";
import { MerchantApply } from "./MerchantApply";
import { ProductForm } from "./ProductForm";
import { PhotoEditor } from "./PhotoEditor";
import { ShareButton } from "./ShareButton";
import { CouponSection } from "./CouponSection";
import { SaleReserveBox } from "./SaleReserveBox";
import { SaleReserveSettings } from "./SaleReserveSettings";
import type { ProductDTO, ReviewDTO, SaleDTO } from "@/lib/types";

type Composing = "sale" | "review" | null;

type TabKey = "products" | "sales" | "coupons" | "notice" | "reviews";

const TABS: { key: TabKey; label: string }[] = [
  { key: "products", label: "메뉴" },
  { key: "sales", label: "세일/행사" },
  { key: "coupons", label: "쿠폰" },
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
    setTab("sales");
    setComposing(null);
    setClosureForm(false);
    setTranslateY(snapPoints().peek);
    loadDetail(storeId);
    track({ storeId, type: "detail_open", source: "detail" }); // M0: 상세 열람 집계
  }, [storeId, snapPoints, loadDetail]);

  const refresh = useCallback(() => {
    setComposing(null);
    if (storeId) loadDetail(storeId);
  }, [storeId, loadDetail]);

  // M6: 사장님/관리자는 시트 내 편집을 숨기고 전용 대시보드(/manage)로 보낸다.
  // 보기 전용 detail(관리 권한 플래그 off) — 소비자와 동일한 시트 화면을 보게 한다.
  const viewDetail =
    detail && detail.canManageStore
      ? { ...detail, canManageMenu: false, canManageStore: false }
      : detail;

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
          className="absolute left-3 top-3 z-20 hidden size-8 items-center justify-center rounded-full bg-white/90 text-ink-2 shadow md:flex"
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
                ) : viewDetail?.canManageStore ? (
                  <button
                    type="button"
                    onClick={() => bannerRef.current?.click()}
                    className="flex h-24 w-full items-center justify-center bg-surface-2 text-sm text-ink-3"
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
                {viewDetail?.canManageStore && detail.bannerUrl && (
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
            <GalleryStrip detail={viewDetail!} storeId={detail.id} onToast={onToast} refresh={refresh} />
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
                    <span className="badge badge--store shrink-0">👑 사장님 직접 관리</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-3">
                      주민들이 관리
                    </span>
                  )}
                  {!detail.verified && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-3">
                      인증중
                    </span>
                  )}
                  {/* M8: 공식 배지 — 라이트(기본)/프로(프리미엄) 구독 가게 (공통 .badge 통일) */}
                  {detail.tier === "pro" ? (
                    <span className="badge badge--pro shrink-0">✅ 공식 프로</span>
                  ) : detail.tier === "lite" ? (
                    <span className="badge badge--official shrink-0">✅ 공식</span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <OpenBadge status={detail.openStatus} />
                  {userLoc ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-wash px-2 py-0.5 font-medium text-brand">
                      <GpsIcon className="size-3" /> 내 위치에서 {formatDistance(haversineMeters(userLoc.lat, userLoc.lng, detail.lat, detail.lng))}
                    </span>
                  ) : (
                    onLocate && (
                      <button
                        type="button"
                        onClick={onLocate}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-ink-3 hover:bg-line-2"
                      >
                        <GpsIcon className="size-3" /> 거리 보기
                      </button>
                    )
                  )}
                  {detail.avgRating !== null && (
                    <span className="text-amber-500">
                      ★ {detail.avgRating}{" "}
                      <span className="text-ink-3">({detail.reviewCount})</span>
                    </span>
                  )}
                  <span className="truncate text-ink-3">{detail.address}</span>
                  <a
                    href={`https://map.kakao.com/link/to/${encodeURIComponent(detail.name)},${detail.lat},${detail.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track({ storeId: detail.id, type: "directions_click", source: "detail" })}
                    className="rounded-full bg-brand-wash px-2 py-0.5 font-medium text-brand hover:bg-brand-wash"
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
                  <span className="text-ink-3">{detail.registeredBy.nickname}님이 등록</span>
                </div>
              </div>
              <ShareButton
                path={`/s/${detail.id}`}
                title={`${detail.name} 세일 정보`}
                text="동네 세일 지도에서 확인해보세요!"
                onShared={() => track({ storeId: detail.id, type: "share", source: "detail" })}
                className="shrink-0 self-start rounded-full border border-line px-2 py-1 text-xs text-ink-3"
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
                <span className={favorite ? "text-red-500" : "text-ink-4"}>
                  {favorite ? "♥" : "♡"}
                </span>
              </button>
            </div>
            </>
          ) : (
            <div className="h-12 animate-pulse rounded bg-surface-2" />
          )}

          {/* 탭 */}
          <div className="mt-3 flex border-b border-line-2">
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
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-3",
                ].join(" ")}
              >
                {t.label}
                {t.key === "coupons" && detail && detail.coupons.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white align-middle">
                    {detail.coupons.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 내용 (스크롤) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {/* M6: 사장님/관리자 — 통계·메뉴·쿠폰·구독 등 모든 관리는 전용 대시보드로. */}
          {detail?.canManageStore && (
            <Link
              href={`/manage/${detail.id}`}
              className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-indigo-700">⚙️ 내 가게 관리</p>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  통계 · 메뉴 · 세일 · 쿠폰 · 사진 · 구독을 넓은 화면에서 관리해요
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                관리 화면 →
              </span>
            </Link>
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
            <p className="py-10 text-center text-sm text-ink-3">불러오는 중…</p>
          ) : tab === "products" ? (
            <ProductsTab
              detail={viewDetail!}
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
          ) : tab === "coupons" ? (
            <CouponSection detail={viewDetail!} onToast={onToast} onDone={refresh} />
          ) : tab === "notice" ? (
            <NoticeTab detail={viewDetail!} onToast={onToast} onClose={onClose} onDone={refresh} />
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
          className="text-xs text-ink-3 underline-offset-2 hover:text-amber-600 hover:underline"
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
        shutdown.length > 0 ? "border-gray-800 bg-surface-2" : "border-amber-300 bg-amber-50",
      ].join(" ")}
    >
      <p className="text-sm font-semibold">
        {shutdown.length > 0 ? "🚫 폐업 제보가 있어요" : "⚠️ 오늘 휴업 제보가 있어요"}
      </p>
      <p className="mt-0.5 text-xs text-ink-3">
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
                <p className="mt-0.5 w-16 truncate text-[10px] text-ink-3">{r.nickname}</p>
              </div>
            ))}
        </div>
      )}
      {reports.find((r) => r.note) && (
        <p className="mt-1 text-xs text-ink-2">“{reports.find((r) => r.note)?.note}”</p>
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

const GALLERY_MAX = 8;

/** M4 프로 사진 갤러리 — 누구나 썸네일 열람, 관리는 프로 사장님/관리자(서버 403 가드). */
export function GalleryStrip({
  detail,
  storeId,
  onToast,
  refresh,
}: {
  detail: StoreDetailDTO;
  storeId: string;
  onToast: (msg: string) => void;
  refresh: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const gallery = detail.galleryUrls ?? [];
  const canManage = detail.canManageStore;

  const patchGallery = async (urls: string[]): Promise<boolean> => {
    const res = await fetch(`/api/stores/${storeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ galleryUrls: urls }),
    });
    if (res.ok) {
      refresh();
      return true;
    }
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    onToast(d.error || "변경에 실패했어요.");
    return false;
  };

  const addPhoto = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (!up.ok) {
        onToast(up.status === 401 ? "로그인이 필요해요." : "사진 업로드 실패");
        return;
      }
      const { url } = (await up.json()) as { url: string };
      if (await patchGallery([...gallery, url].slice(0, GALLERY_MAX))) onToast("사진을 추가했어요.");
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async (url: string) => {
    if (await patchGallery(gallery.filter((u) => u !== url))) onToast("사진을 삭제했어요.");
  };

  if (gallery.length === 0 && !canManage) return null;

  return (
    <div className="-mx-4 mb-2 px-4">
      {gallery.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {gallery.map((url) => (
            <div key={url} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />
              {canManage && (
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1 text-[10px] leading-tight text-white"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {canManage &&
        (detail.pro ? (
          gallery.length < GALLERY_MAX && (
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="mt-1 rounded-lg border border-dashed border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-600 disabled:opacity-50"
            >
              {busy ? "업로드 중…" : `＋ 갤러리 사진 추가 (프로 · ${gallery.length}/${GALLERY_MAX})`}
            </button>
          )
        ) : (
          <Link
            href={`/stores/${storeId}/sponsor`}
            className="mt-1 inline-block rounded-lg border border-dashed border-line px-3 py-1 text-xs text-ink-3"
          >
            🖼️ 프로 플랜에서 사진 갤러리를 추가할 수 있어요 →
          </Link>
        ))}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addPhoto(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** M4 프로 확장 분석: 30·90일 합계 + 30일 일별 노출 추이 + 요일별 노출. */
export function ProStats({ stats }: { stats: StoreStats }) {
  const l30 = stats.last30 ?? {};
  const l90 = stats.last90 ?? {};
  const daily = stats.daily ?? [];
  const weekday = stats.weekday ?? [];
  const maxDaily = Math.max(1, ...daily.map((d) => d.impressions));
  const maxWd = Math.max(1, ...weekday.map((w) => w.impressions));
  return (
    <div className="mt-2 border-t border-line-2 pt-2">
      <p className="text-[11px] font-bold text-brand-ink">⭐ 프로 확장 분석</p>
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-surface-2 px-2 py-1.5">
          <p className="text-[10px] font-medium text-ink-3">최근 30일</p>
          <p className="num text-xs font-bold text-ink">
            노출 {l30.impressions ?? 0} · 상세 {l30.detailOpens ?? 0}
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 px-2 py-1.5">
          <p className="text-[10px] font-medium text-ink-3">최근 90일</p>
          <p className="num text-xs font-bold text-ink">
            노출 {l90.impressions ?? 0} · 상세 {l90.detailOpens ?? 0}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[10px] font-medium text-ink-3">최근 30일 노출 추이</p>
      <div className="mt-1 flex h-12 items-end gap-px">
        {daily.map((d) => (
          <div
            key={d.day}
            className="flex-1 rounded-sm bg-brand"
            style={{ height: `${Math.max(2, (d.impressions / maxDaily) * 100)}%` }}
            title={`${d.day}: 노출 ${d.impressions}`}
          />
        ))}
      </div>

      <p className="mt-2 text-[10px] font-medium text-ink-3">요일별 노출</p>
      <div className="mt-1 flex items-end gap-1">
        {weekday.map((w, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
            <div
              className="w-full rounded-sm bg-brand/55"
              style={{ height: `${Math.max(2, (w.impressions / maxWd) * 40)}px` }}
              title={`${WEEKDAY_LABELS[i]}: ${w.impressions}`}
            />
            <span className="text-[9px] font-medium text-ink-3">{WEEKDAY_LABELS[i]}</span>
          </div>
        ))}
      </div>

      {stats.benchmark && <Benchmark b={stats.benchmark} />}
    </div>
  );
}

/** M11: 동종업종 벤치마크 — 같은 동·업종 평균 대비 우리 가게(최근 30일). */
function Benchmark({ b }: { b: NonNullable<StoreStats["benchmark"]> }) {
  const cmp = (mine: number, avg: number) => {
    if (avg === 0) return { txt: mine > 0 ? "평균 0" : "—", cls: "text-ink-4" };
    const pct = Math.round((mine / avg) * 100);
    return pct >= 100
      ? { txt: `평균의 ${pct}%`, cls: "text-verify-ink" }
      : { txt: `평균의 ${pct}%`, cls: "text-deal-ink" };
  };
  const ROWS: [string, number, number][] = [
    ["노출", b.mine.impressions, b.avg.impressions],
    ["상세열람", b.mine.detailOpens, b.avg.detailOpens],
    ["방문의향", b.mine.intentVisits, b.avg.intentVisits],
  ];
  return (
    <div className="mt-3 rounded-xl border border-line bg-brand-wash/60 p-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-brand-ink">📊 동종업종 벤치마크</p>
        <span className="num rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-brand-ink">
          {b.region} 동종 상위 {100 - b.percentile}%
        </span>
      </div>
      <p className="mt-0.5 text-[10px] font-medium text-ink-3">{b.region} 같은 업종 {b.peerCount}곳 평균 대비(최근 30일)</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {ROWS.map(([label, mine, avg]) => {
          const c = cmp(mine, avg);
          return (
            <div key={label} className="rounded-lg bg-white px-2 py-1.5 text-center">
              <p className="text-[10px] font-medium text-ink-3">{label}</p>
              <p className="num text-sm font-extrabold text-ink">{mine}</p>
              <p className={`text-[10px] font-bold ${c.cls}`}>{c.txt}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OpenBadge({ status }: { status: StoreDetailDTO["openStatus"] }) {
  if (status === null) {
    return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-3">영업정보 없음</span>;
  }
  if (status === "open") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">영업중</span>
    );
  }
  if (status === "preparing") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
        영업준비중
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-200 px-2 py-0.5 font-medium text-ink-2">영업종료</span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm font-medium text-ink-3">{children}</p>;
}

export function ProductsTab({
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

  const [filter, setFilter] = useState<"all" | "sale">("all");

  const remove = async (id: string) => {
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      onToast("메뉴를 삭제했어요.");
      onDone();
    } else {
      onToast(res.status === 403 ? "권한이 없어요." : "삭제에 실패했어요.");
    }
  };

  // 활성 세일을 상품(메뉴)별로 묶어 '가장 싼' 세일 1개를 대표로 매칭(productId 연결분만).
  // 상품과 연결되지 않은 단독 세일은 메뉴 리스트가 아닌 세일/행사 탭에 남는다(구조 불변).
  const saleByProduct = new Map<string, SaleDTO>();
  for (const s of detail.sales) {
    if (!s.productId) continue;
    const cur = saleByProduct.get(s.productId);
    if (!cur || s.salePrice < cur.salePrice) saleByProduct.set(s.productId, s);
  }
  const emoji = CATEGORY_META[detail.category].icon;
  // 세일 행을 항상 리스트 최상단에 고정(전체 모드에서도 세일이 먼저).
  const rows = detail.products
    .map((p) => ({ product: p, sale: saleByProduct.get(p.id) ?? null }))
    .sort((a, b) => (a.sale ? 0 : 1) - (b.sale ? 0 : 1));
  const saleCount = rows.filter((r) => r.sale).length;
  const visible = filter === "sale" ? rows.filter((r) => r.sale) : rows;

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
            className="min-h-[48px] rounded-lg border border-brand text-sm font-bold text-brand"
          >
            ＋ 메뉴 추가
          </button>
        ))}

      {!detail.hasOwner && (
        <p className="text-sm text-ink-3">
          사장님 미등록 가게예요. 이웃 누구나 메뉴를 등록·수정할 수 있어요.
        </p>
      )}

      {detail.products.length === 0 ? (
        <EmptyState>아직 등록된 메뉴가 없어요.</EmptyState>
      ) : (
        <>
          {/* 세그먼트 토글: 전체 / 🔥 세일만 (50~60대 큰 터치 ≥56px) */}
          <div className="seg-toggle" role="tablist" aria-label="메뉴 필터">
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              className={filter === "all" ? "is-on" : ""}
              onClick={() => setFilter("all")}
            >
              전체 <span className="seg-count num">{rows.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "sale"}
              className={filter === "sale" ? "is-on is-sale" : ""}
              onClick={() => setFilter("sale")}
            >
              🔥 세일만 <span className="seg-count num">{saleCount}</span>
            </button>
          </div>

          {filter === "sale" && saleCount === 0 ? (
            <div className="rounded-card border border-line bg-surface p-6 text-center">
              <p className="text-base font-bold text-ink">오늘은 세일이 없어요</p>
              <p className="mt-1 text-sm text-ink-3">전체 메뉴를 둘러보세요.</p>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-3 min-h-[48px] rounded-btn bg-brand px-5 text-sm font-bold text-white"
              >
                전체 보기
              </button>
            </div>
          ) : (
            <div className="menu-list">
              {visible.map(({ product: p, sale }) => {
                const off =
                  sale && p.price > sale.salePrice && p.price > 0
                    ? Math.round((1 - sale.salePrice / p.price) * 100)
                    : 0;
                const meta = [
                  p.qtyUnit,
                  p.origin,
                  p.stock !== null ? `재고 ${p.stock}` : null,
                ]
                  .filter((x) => x && String(x).trim())
                  .join(" · ");
                const price = sale ? sale.salePrice : p.price;
                return (
                  <div
                    key={p.id}
                    className={`menu-row${sale ? " menu-row--sale" : ""}`}
                    data-sale={sale ? 1 : 0}
                  >
                    <span className="menu-ic">
                      {p.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photoUrl} alt="" />
                      ) : (
                        emoji
                      )}
                    </span>
                    <div className="menu-main">
                      <div className="flex items-center gap-1.5">
                        <span className="menu-name truncate">{p.name}</span>
                        {off > 0 && <span className="badge-off num">{off}%↓</span>}
                      </div>
                      {sale ? (
                        <p className="menu-sub">
                          {p.price > sale.salePrice && (
                            <>
                              <s className="num">{won(p.price)}</s>
                              {" · "}
                            </>
                          )}
                          <Countdown to={sale.expiresAt} />
                        </p>
                      ) : (
                        meta && <p className="menu-sub">{meta}</p>
                      )}
                      <div className="mt-1 flex items-center gap-1.5">
                        <Avatar img={p.contributorImg} />
                        <span className="text-xs text-ink-3">{p.contributorNickname}</span>
                        <span className="text-xs text-ink-4">·</span>
                        <span className="text-xs text-ink-3">{freshnessLabel(p.updatedAt)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        {detail.canManageMenu && (
                            <>
                              <button
                                type="button"
                                onClick={() => setComposing({ mode: "edit", product: p })}
                                className="min-h-[40px] rounded-lg border border-line px-3 text-xs font-bold text-brand"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(p.id)}
                                className="min-h-[40px] rounded-lg border border-line px-3 text-xs font-bold text-red-500"
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
                    <div className="menu-price num">
                      {price.toLocaleString("ko-KR")}
                      <small>원</small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Avatar({ img }: { img: string | null }) {
  return (
    <span className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-[10px]">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="size-full object-cover" />
      ) : (
        "🙂"
      )}
    </span>
  );
}

export function SalesTab({
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
          canNotify={detail.canManageStore && (detail.tier === "lite" || detail.tier === "pro")}
        />
      ) : (
        <button
          type="button"
          onClick={onCompose}
          className="rounded-lg border border-brand py-2 text-sm font-medium text-brand"
        >
          🔥 세일 제보하기
        </button>
      )}

      {detail.priceTrends.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">📈 가격 추이 <span className="font-normal text-ink-3">(최근 90일 세일가)</span></h3>
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
        <li key={s.id} className="overflow-hidden rounded-xl border border-line-2">
          <PhotoCarousel urls={s.photoUrls?.length ? s.photoUrls : s.photoUrl ? [s.photoUrl] : []} />
          <div className="p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-medium">{s.title}</p>
              <p className="shrink-0 font-bold text-red-600">{won(s.salePrice)}</p>
            </div>
            {s.qty?.trim() && <p className="text-xs text-ink-3">{s.qty}</p>}
            <div className="mt-0.5 flex items-center gap-2 text-xs">
              <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600">
                {untilLabel(s.expiresAt)}
              </span>
              <span className="text-ink-3">{freshnessLabel(s.createdAt)}</span>
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
            {detail.canManageStore ? (
              <SaleReserveSettings sale={s} onToast={onToast} onDone={onDone} />
            ) : (
              s.reservation && <SaleReserveBox sale={s} onToast={onToast} onDone={onDone} />
            )}
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
          className="rounded-lg border border-brand/40 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-wash"
        >
          수정
        </button>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

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
        <p className="whitespace-pre-wrap text-ink-2">
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
          <label className="text-xs text-ink-3">주소</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
          <label className="text-xs text-ink-3">전화번호 (선택)</label>
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
        <dl className="flex flex-col gap-1 text-ink-2">
          <div className="flex gap-2">
            <dt className="w-12 shrink-0 text-ink-3">주소</dt>
            <dd>{detail.address}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-12 shrink-0 text-ink-3">전화</dt>
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
                  <span className="flex-1 text-ink-3">휴무</span>
                ) : (
                  <span className="flex flex-1 items-center gap-1">
                    <input
                      type="time"
                      value={v.open}
                      onChange={(e) => setDay(d, { open: e.target.value })}
                      className="rounded border border-line px-2 py-1"
                    />
                    <span className="text-ink-3">–</span>
                    <input
                      type="time"
                      value={v.close}
                      onChange={(e) => setDay(d, { close: e.target.value })}
                      className="rounded border border-line px-2 py-1"
                    />
                  </span>
                )}
                <label className="flex shrink-0 items-center gap-1 text-xs text-ink-3">
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
        <ul className="flex flex-col gap-0.5 text-ink-2">
          {DAY_KEYS.map((d) => {
            const today = getKstNow().dayKey === d;
            return (
              <li
                key={d}
                className={`flex justify-between ${today ? "font-semibold text-ink" : ""}`}
              >
                <span>{DAY_LABELS[d]}</span>
                <span>{formatDayHours(detail.hours?.[d] ?? null)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-ink-3">영업시간 정보가 없어요.</p>
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
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
      >
        {busy ? "저장 중…" : "저장"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-3 hover:bg-surface-2"
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
                className="text-xs text-red-500 disabled:text-ink-4"
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
              className="text-xs text-ink-3"
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

export function NoticeTab({
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

      <section className="border-t border-line-2 pt-3">
        <MerchantApply
          storeId={detail.id}
          hasOwner={detail.hasOwner}
          isOwner={detail.isOwner}
          onToast={onToast}
        />
      </section>

      <section className="border-t border-line-2 pt-3">
        <span className="text-ink-3">잘못된 가게 정보인가요? </span>
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
          className="rounded-lg border border-brand py-2 text-sm font-medium text-brand"
        >
          ✍️ 리뷰 쓰기
        </button>
      )}

      {detail.avgRating !== null && (
        <div className="flex items-center gap-2 border-b border-line-2 pb-2">
          <span className="text-2xl font-bold">{detail.avgRating}</span>
          <span className="text-amber-500">{starString(detail.avgRating)}</span>
          <span className="text-xs text-ink-3">리뷰 {detail.reviewCount}개</span>
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
                  <span className="text-xs text-ink-3">{reviewDateLabel(r.createdAt)}</span>
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
                    <div key={i} className="zoomable size-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="size-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-ink-4">
                  {!r.scored && "별점·포인트 미반영"}
                </span>
                <div className="flex items-center gap-3">
                  {r.isMine && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditReview(r)}
                        className="text-xs text-brand"
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
              <ReviewReplyBox
                reviewId={r.id}
                storeId={detail.id}
                reply={r.reply}
                canManage={detail.canManageStore}
                tier={detail.tier}
                onToast={onToast}
                onChanged={onDone}
              />
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
      <div className="flex aspect-video w-full items-center justify-center bg-surface-2 text-3xl text-ink-4">
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
