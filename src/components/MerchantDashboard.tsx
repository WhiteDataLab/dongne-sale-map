"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORY_META } from "@/lib/constants";
import type { StoreDetailDTO } from "@/lib/types";
import {
  ProductsTab,
  SalesTab,
  NoticeTab,
  GalleryStrip,
  ProStats,
  type StoreStats,
} from "@/components/StoreSheet";
import { CouponSection } from "@/components/CouponSection";

/**
 * M6 — 사장님 전용 풀페이지 관리 콘솔.
 * 좁은 바텀시트 대신 넓은 화면에서 통계·메뉴·세일·쿠폰·사진·가게정보·구독을 관리한다.
 * 시트와 동일한 섹션 컴포넌트를 재사용(중복 제거)하되, 여기선 실제 detail(소유자 권한)로 풀 관리.
 */

type Section = "stats" | "menu" | "sales" | "coupons" | "photos" | "info" | "subscription";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "stats", label: "📊 통계" },
  { key: "menu", label: "🍱 메뉴" },
  { key: "sales", label: "🔥 세일/행사" },
  { key: "coupons", label: "🎟️ 쿠폰" },
  { key: "photos", label: "🖼️ 사진" },
  { key: "info", label: "🏪 가게 정보" },
  { key: "subscription", label: "👑 구독·플랜" },
];

const METRICS = [
  ["노출", "impressions"],
  ["상세열람", "detailOpens"],
  ["길찾기", "directionsClicks"],
  ["즐겨찾기", "favorites"],
  ["공유", "shares"],
  ["방문의향", "intentVisits"],
] as const;

export function MerchantDashboard({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [detail, setDetail] = useState<StoreDetailDTO | null>(null);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [section, setSection] = useState<Section>("stats");
  const [salesComposing, setSalesComposing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/stores/${storeId}`);
      if (res.ok) setDetail((await res.json()) as StoreDetailDTO);
    } catch {
      /* ignore */
    }
  }, [storeId]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/stores/${storeId}/stats`);
      if (res.ok) setStats((await res.json()) as StoreStats);
    } catch {
      /* ignore */
    }
  }, [storeId]);

  useEffect(() => {
    load();
    loadStats();
  }, [load, loadStats]);

  const refresh = useCallback(() => {
    load();
    loadStats();
  }, [load, loadStats]);

  const planLabel =
    detail?.sponsorSubscription?.plan === "pro"
      ? "프로"
      : detail?.sponsorSubscription
        ? "스폰서"
        : null;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-2xl p-4">
        {/* 헤더 */}
        <header className="mb-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xs text-gray-400">← 지도</Link>
            <Link href={`/?store=${storeId}`} className="text-xs text-blue-600">소비자 화면 미리보기 →</Link>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              {detail ? CATEGORY_META[detail.category].icon : "🏪"}
            </span>
            <h1 className="truncate text-lg font-bold">{detail?.name ?? storeName}</h1>
            {planLabel && (
              <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                {planLabel}
              </span>
            )}
            {detail && !detail.verified && (
              <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] text-gray-500">미인증</span>
            )}
          </div>
        </header>

        {/* 섹션 네비 */}
        <nav className="sticky top-0 z-10 -mx-4 mb-3 border-b border-gray-200 bg-gray-50/95 px-4 py-1.5 backdrop-blur">
          <div className="flex gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={[
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                  section === s.key ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100",
                ].join(" ")}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {!detail ? (
          <p className="py-16 text-center text-sm text-gray-400">불러오는 중…</p>
        ) : (
          <main className="rounded-2xl border border-gray-200 bg-white p-4">
            {section === "stats" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">우리 가게 반응</h2>
                {!stats ? (
                  <p className="py-8 text-center text-sm text-gray-400">집계를 불러오는 중…</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-1.5">
                      {METRICS.map(([label, key]) => (
                        <div key={key} className="rounded-lg bg-blue-50/60 px-2 py-2 text-center">
                          <p className="text-[11px] text-gray-400">{label}</p>
                          <p className="text-lg font-bold text-gray-800">{stats.today[key] ?? 0}</p>
                          <p className="text-[10px] text-gray-400">7일 {stats.last7[key] ?? 0}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10px] text-gray-400">오늘(큰 숫자) · 최근 7일 합계</p>
                    {stats.pro ? (
                      <ProStats stats={stats} />
                    ) : (
                      <p className="mt-3 rounded-lg bg-indigo-50 p-2.5 text-center text-xs text-indigo-600">
                        ⭐ 프로 플랜이면 30·90일 추이와 요일별 분석을 볼 수 있어요.{" "}
                        <button type="button" onClick={() => setSection("subscription")} className="font-bold underline">
                          업그레이드
                        </button>
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {section === "menu" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">메뉴 관리</h2>
                <ProductsTab detail={detail} onToast={showToast} onDone={refresh} />
              </div>
            )}

            {section === "sales" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">세일/행사</h2>
                <SalesTab
                  detail={detail}
                  composing={salesComposing}
                  onCompose={() => setSalesComposing(true)}
                  onClose={() => setSalesComposing(false)}
                  onDone={() => {
                    setSalesComposing(false);
                    refresh();
                  }}
                  onToast={showToast}
                />
              </div>
            )}

            {section === "coupons" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">쿠폰 발행·관리</h2>
                <CouponSection detail={detail} onToast={showToast} onDone={refresh} />
              </div>
            )}

            {section === "photos" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">가게 사진</h2>
                <BannerEditor detail={detail} onToast={showToast} refresh={refresh} />
                <p className="mb-1 mt-4 text-xs font-semibold text-gray-500">갤러리 (여러 장)</p>
                <GalleryStrip detail={detail} storeId={storeId} onToast={showToast} refresh={refresh} />
              </div>
            )}

            {section === "info" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">가게 정보</h2>
                {/* 공지 + 기본정보 + 영업시간 (시트와 동일 섹션 재사용) */}
                <NoticeTab detail={detail} onToast={showToast} onClose={() => {}} onDone={refresh} />
              </div>
            )}

            {section === "subscription" && (
              <SubscriptionPanel detail={detail} storeId={storeId} onToast={showToast} refresh={refresh} />
            )}
          </main>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}

/** 가게 메인 사진(배너) 업로드/삭제. PATCH /api/stores/[id]. */
function BannerEditor({
  detail,
  onToast,
  refresh,
}: {
  detail: StoreDetailDTO;
  onToast: (m: string) => void;
  refresh: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const patch = async (bannerUrl: string | null) => {
    const res = await fetch(`/api/stores/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bannerUrl }),
    });
    if (res.ok) {
      onToast(bannerUrl ? "메인 사진을 등록했어요." : "메인 사진을 삭제했어요.");
      refresh();
    } else {
      onToast("변경에 실패했어요.");
    }
  };

  const upload = async (file: File) => {
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
      await patch(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-gray-500">메인 사진</p>
      {detail.bannerUrl ? (
        <div className="relative overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={detail.bannerUrl} alt="" className="h-40 w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-1">
            <button
              type="button"
              onClick={() => ref.current?.click()}
              className="rounded bg-black/60 px-2 py-1 text-xs text-white"
            >
              변경
            </button>
            <button type="button" onClick={() => patch(null)} className="rounded bg-black/60 px-2 py-1 text-xs text-white">
              삭제
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => ref.current?.click()}
          className="flex h-28 w-full items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400 disabled:opacity-50"
        >
          {busy ? "업로드 중…" : "＋ 메인 사진 추가"}
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** 구독(스폰서/프로) 상태 + 해지 또는 업셀 링크. */
function SubscriptionPanel({
  detail,
  storeId,
  onToast,
  refresh,
}: {
  detail: StoreDetailDTO;
  storeId: string;
  onToast: (m: string) => void;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const sub = detail.sponsorSubscription;

  const cancel = async () => {
    if (!sub) return;
    if (!window.confirm("구독을 해지할까요? 다음 결제부터 중단되며, 현재 노출은 만료일까지 유지돼요.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error();
      onToast("구독을 해지했어요.");
      refresh();
    } catch {
      onToast("해지에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const changePlan = async (target: "sponsor" | "pro") => {
    if (!sub) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target }),
      });
      if (!res.ok) throw new Error();
      onToast(target === "pro" ? "프로로 업그레이드했어요! 🎉" : "스폰서 플랜으로 변경했어요.");
      refresh();
    } catch {
      onToast("변경에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (!sub) {
    return (
      <div>
        <h2 className="mb-2 text-sm font-bold">구독·플랜</h2>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-center">
          <p className="text-2xl">👑</p>
          <p className="mt-1 text-sm font-semibold">아직 구독 중이 아니에요</p>
          <p className="mt-1 text-xs text-gray-500">
            스폰서(마퀴 고정 + 금색 핀) 또는 프로(스폰서 + 확장통계·무제한쿠폰·갤러리·상위노출) 플랜으로 가게를 키워보세요.
          </p>
          <Link
            href={`/stores/${storeId}/sponsor`}
            className="mt-3 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white"
          >
            플랜 보기 (14일 무료) →
          </Link>
        </div>
      </div>
    );
  }

  const statusLabel =
    sub.status === "trialing" ? "무료체험 중" : sub.status === "past_due" ? "결제 재시도 중" : "이용 중";

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold">구독·플랜</h2>
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-amber-800">
            👑 {sub.plan === "pro" ? "프로" : "스폰서"} 플랜
          </p>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-amber-700">{statusLabel}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          다음 결제 예정일 {new Date(sub.nextBillingAt).toLocaleDateString("ko-KR")} ·{" "}
          {(sub.plan === "pro" ? 49800 : 29800).toLocaleString("ko-KR")}원/월
        </p>

        {sub.plan !== "pro" && (
          <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3">
            <p className="text-xs font-semibold text-indigo-700">⭐ 프로로 업그레이드</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              확장통계 · 무제한쿠폰 · 사진갤러리 · 상위노출이 <b>지금 바로</b> 켜져요. 추가 청구 없이 다음 결제부터
              49,800원으로 적용돼요.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => changePlan("pro")}
              className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "처리 중…" : "프로로 업그레이드 (49,800원/월)"}
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          {sub.plan === "pro" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("스폰서 플랜으로 변경할까요? 프로 혜택(확장통계·무제한쿠폰·갤러리·상위노출)이 해제돼요.")) {
                  changePlan("sponsor");
                }
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              스폰서로 변경
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={cancel}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            구독 해지
          </button>
        </div>
      </div>
    </div>
  );
}
