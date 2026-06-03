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
} from "@/lib/businessHours";
import { freshnessLabel, starString, untilLabel, won } from "@/lib/format";
import type { StoreDetailDTO } from "@/lib/types";
import { SaleReportForm } from "./SaleReportForm";
import { ReviewForm } from "./ReviewForm";
import { ReportButton } from "./ReportButton";

type Composing = "sale" | "review" | null;

type TabKey = "products" | "sales" | "notice" | "reviews";

const TABS: { key: TabKey; label: string }[] = [
  { key: "products", label: "상품" },
  { key: "sales", label: "세일" },
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
}: {
  storeId: string | null;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [detail, setDetail] = useState<StoreDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>("sales");
  const [favorite, setFavorite] = useState(false);
  const [composing, setComposing] = useState<Composing>(null);

  // 시트 세로 위치(px). 작을수록 위로 펼쳐짐.
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
    setTranslateY(snapPoints().peek);
    loadDetail(storeId);
  }, [storeId, snapPoints, loadDetail]);

  const refresh = useCallback(() => {
    setComposing(null);
    if (storeId) loadDetail(storeId);
  }, [storeId, loadDetail]);

  const onPointerDown = (e: ReactPointerEvent) => {
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
    <div className="absolute inset-0 z-40">
      {/* 백드롭 (탭하면 닫힘) */}
      <div
        className="absolute inset-0 bg-black transition-opacity"
        style={{ opacity: backdropOpacity }}
        onClick={onClose}
      />

      {/* 시트 */}
      <div
        className="absolute inset-x-0 top-0 flex h-full touch-none flex-col rounded-t-2xl bg-white shadow-2xl will-change-transform"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: dragRef.current ? "none" : "transform 0.25s ease-out",
        }}
      >
        {/* 드래그 핸들 + 헤더 */}
        <div
          className="shrink-0 cursor-grab touch-none rounded-t-2xl px-4 pt-2 pb-3 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />

          {detail ? (
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden>
                {meta?.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-bold">{detail.name}</h2>
                  {detail.source === "merchant" ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      👑 사장님 가게
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      주민 등록
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
                  {detail.avgRating !== null && (
                    <span className="text-amber-500">
                      ★ {detail.avgRating}{" "}
                      <span className="text-gray-400">({detail.reviewCount})</span>
                    </span>
                  )}
                  <span className="truncate text-gray-400">{detail.address}</span>
                </div>
              </div>
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
                  }
                }}
                className="shrink-0 text-2xl leading-none"
              >
                <span className={favorite ? "text-red-500" : "text-gray-300"}>
                  {favorite ? "♥" : "♡"}
                </span>
              </button>
            </div>
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
          {loading || !detail ? (
            <p className="py-10 text-center text-sm text-gray-400">불러오는 중…</p>
          ) : tab === "products" ? (
            <ProductsTab detail={detail} />
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
            <NoticeTab detail={detail} onToast={onToast} onClose={onClose} />
          ) : (
            <ReviewsTab
              detail={detail}
              composing={composing === "review"}
              onCompose={() => setComposing("review")}
              onClose={() => setComposing(null)}
              onDone={refresh}
              onToast={onToast}
            />
          )}
        </div>
      </div>
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

function ProductsTab({ detail }: { detail: StoreDetailDTO }) {
  if (detail.products.length === 0) {
    return <EmptyState>아직 등록된 상품이 없어요.</EmptyState>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {detail.products.map((p) => (
        <li key={p.id} className="flex gap-3">
          <Thumb url={p.photoUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-medium">{p.name}</p>
              <p className="shrink-0 font-bold">{won(p.price)}</p>
            </div>
            <p className="text-xs text-gray-500">
              {p.qtyUnit}
              {p.origin ? ` · ${p.origin}` : ""}
              {p.stock !== null ? ` · 재고 ${p.stock}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">{freshnessLabel(p.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
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

      {detail.sales.length === 0 ? (
        <EmptyState>지금 진행중인 세일이 없어요. 첫 제보를 남겨보세요!</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {detail.sales.map((s) => (
        <li key={s.id} className="flex gap-3">
          <Thumb url={s.photoUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-medium">{s.title}</p>
              <p className="shrink-0 font-bold text-red-600">{won(s.salePrice)}</p>
            </div>
            <p className="text-xs text-gray-500">{s.qty}</p>
            <div className="mt-0.5 flex items-center gap-2 text-xs">
              <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600">
                {untilLabel(s.expiresAt)}
              </span>
              <span className="text-gray-400">{freshnessLabel(s.createdAt)}</span>
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

function NoticeTab({
  detail,
  onToast,
  onClose,
}: {
  detail: StoreDetailDTO;
  onToast: (msg: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h3 className="mb-1 font-semibold">가게 소개</h3>
        <p className="whitespace-pre-wrap text-gray-600">
          {detail.description?.trim() || "아직 등록된 소개가 없어요."}
        </p>
      </section>

      <section>
        <h3 className="mb-1 font-semibold">기본 정보</h3>
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
      </section>

      <section>
        <h3 className="mb-1 font-semibold">영업시간</h3>
        {detail.hours ? (
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
        <ReviewForm
          storeId={detail.id}
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
                <span className="text-sm font-medium">{r.nickname}</span>
                <span className="text-amber-500 text-sm">{starString(r.rating)}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{r.content}</p>
              <div className="mt-1">
                <ReportButton
                  targetType="review"
                  targetId={r.id}
                  onToast={onToast}
                  onChanged={onDone}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* TODO(phase-3): 리뷰 작성/평점 입력 */}
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-gray-300">🧺</div>
      )}
    </div>
  );
}
