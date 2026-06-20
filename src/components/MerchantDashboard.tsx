"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORY_META } from "@/lib/constants";
import type { StoreDetailDTO } from "@/lib/types";
import { PLAN_LABEL, PLAN_PRICE_KRW, asSubPlan, type SubPlan } from "@/lib/sponsors";
import {
  ProductsTab,
  SalesTab,
  NoticeTab,
  GalleryStrip,
  ProStats,
  type StoreStats,
} from "@/components/StoreSheet";
import { CouponSection } from "@/components/CouponSection";
import { MerchantReservations } from "@/components/MerchantReservations";
import { MerchantAlerts } from "@/components/MerchantAlerts";
import { MerchantRegulars } from "@/components/MerchantRegulars";
import { MerchantAdCampaign } from "@/components/MerchantAdCampaign";

/**
 * M6 — 사장님 전용 풀페이지 관리 콘솔.
 * 좁은 바텀시트 대신 넓은 화면에서 통계·메뉴·세일·쿠폰·사진·가게정보·구독을 관리한다.
 * 시트와 동일한 섹션 컴포넌트를 재사용(중복 제거)하되, 여기선 실제 detail(소유자 권한)로 풀 관리.
 */

type Section =
  | "stats"
  | "menu"
  | "sales"
  | "alerts"
  | "regulars"
  | "reservations"
  | "coupons"
  | "ads"
  | "photos"
  | "info"
  | "subscription";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "stats", label: "📊 통계" },
  { key: "menu", label: "🍱 메뉴" },
  { key: "sales", label: "🔥 세일/행사" },
  { key: "alerts", label: "🔔 단골 알림" },
  { key: "regulars", label: "🧑‍🤝‍🧑 단골 관리" },
  { key: "reservations", label: "🏃 예약" },
  { key: "coupons", label: "🎟️ 쿠폰" },
  { key: "ads", label: "🚀 광고(CPA)" },
  { key: "photos", label: "🖼️ 사진" },
  { key: "info", label: "🏪 가게 정보" },
  { key: "subscription", label: "👑 구독·플랜" },
];

// P1-b: '우리 가게 반응' 미니 스탯(최근 7일). 갈래요는 hot=따뜻한 색으로 강조.
const MINI_STATS: [label: string, key: string, hot: boolean][] = [
  ["상세 열람", "detailOpens", false],
  ["길찾기", "directionsClicks", false],
  ["🏃 갈래요", "intentVisits", true],
  ["즐겨찾기", "favorites", false],
];

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

  const planLabel = detail?.sponsorSubscription ? PLAN_LABEL[asSubPlan(detail.sponsorSubscription.plan)] : null;

  return (
    <div className="h-full overflow-y-auto bg-surface-2">
      <div className="mx-auto max-w-2xl p-4">
        {/* 헤더 */}
        <header className="mb-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xs text-ink-3">← 지도</Link>
            <Link href={`/?store=${storeId}`} className="text-xs text-brand">소비자 화면 미리보기 →</Link>
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
              <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] text-ink-3">미인증</span>
            )}
          </div>
        </header>

        {/* 섹션 네비 */}
        <nav className="sticky top-0 z-10 -mx-4 mb-3 border-b border-line bg-surface-2/95 px-4 py-1.5 backdrop-blur">
          <div className="flex gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={[
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                  section === s.key ? "bg-gray-900 text-white" : "text-ink-3 hover:bg-surface-2",
                ].join(" ")}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {!detail ? (
          <p className="py-16 text-center text-sm text-ink-3">불러오는 중…</p>
        ) : (
          <main className="rounded-2xl border border-line bg-white p-4">
            {section === "stats" && (
              <div>
                {!stats ? (
                  <p className="py-8 text-center text-sm text-ink-3">집계를 불러오는 중…</p>
                ) : (
                  <>
                    {/* 큰 숫자 히어로 — "느낄 수 있는" 반응 */}
                    <p className="text-xs font-bold tracking-tight text-ink-3">
                      📊 이번 주 우리 가게 반응
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="num text-4xl font-extrabold text-ink">
                        {stats.last7.impressions ?? 0}
                      </span>
                      <span className="text-sm font-bold text-ink-2">명이 봤어요</span>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-ink-3">
                      오늘 {stats.today.impressions ?? 0}명이 봤어요
                    </p>

                    {/* 미니 스탯 (최근 7일) */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {MINI_STATS.map(([label, key, hot]) => (
                        <div key={key} className="rounded-[13px] bg-surface-2 px-3 py-2.5">
                          <span
                            className={[
                              "num block text-xl font-extrabold",
                              hot ? "text-deal-ink" : "text-ink",
                            ].join(" ")}
                          >
                            {stats.last7[key] ?? 0}
                          </span>
                          <span className="text-[11.5px] font-semibold text-ink-3">{label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10px] text-ink-4">최근 7일 합계</p>

                    {/* 잠금 업셀: 값을 보여준 뒤 자물쇠 (무료 티어 → 라이트 유도) */}
                    {detail.tier === "free" && (
                      <button
                        type="button"
                        onClick={() => setSection("subscription")}
                        className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand bg-brand-wash px-3.5 py-3 text-left"
                      >
                        <span className="text-lg">🔔</span>
                        <span className="flex-1">
                          <b className="block text-[13.5px] font-extrabold text-brand-ink">
                            단골에게 세일 알림 보내기
                          </b>
                          <span className="text-[11.5px] font-semibold text-brand-ink/80">
                            {(stats.last7.intentVisits ?? 0) > 0
                              ? `갈래요한 ${stats.last7.intentVisits}명부터 먼저 손 뻗어요`
                              : "먼저 손 뻗으면 더 와요"}{" "}
                            · 전단지 한 장 값
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-brand px-2.5 py-1.5 text-[11px] font-extrabold text-white">
                          라이트부터
                        </span>
                      </button>
                    )}

                    {/* 프로: 확장 통계 / (라이트) 프로 업셀 */}
                    {stats.pro ? (
                      <ProStats stats={stats} />
                    ) : detail.tier !== "free" ? (
                      <p className="mt-3 rounded-xl bg-brand-wash p-2.5 text-center text-xs font-semibold text-brand-ink">
                        ⭐ 프로 플랜이면 30·90일 추이와 요일별 분석을 볼 수 있어요.{" "}
                        <button
                          type="button"
                          onClick={() => setSection("subscription")}
                          className="font-extrabold underline"
                        >
                          업그레이드
                        </button>
                      </p>
                    ) : null}
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

            {section === "alerts" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">단골 알림 발송</h2>
                <p className="mb-3 text-xs text-ink-3">
                  우리 가게를 즐겨찾기한 손님에게 세일·소식을 인앱 알림으로 보내요. 손님이 알림함에서 확인해요.
                </p>
                <MerchantAlerts storeId={storeId} sales={detail.sales} onToast={showToast} />
              </div>
            )}

            {section === "regulars" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">단골 관리</h2>
                <p className="mb-3 text-xs text-ink-3">
                  누가 우리 단골이고 요즘 안 오는 손님이 누군지 보고, (프로) 이탈 단골에게 컴백 쿠폰을 보내요.
                </p>
                <MerchantRegulars storeId={storeId} onToast={showToast} />
              </div>
            )}

            {section === "reservations" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">픽업 예약</h2>
                <p className="mb-3 text-xs text-ink-3">
                  마감임박 떨이를 손님이 앱에서 선점하고 매장에서 픽업해요(현장결제). 세일/행사 탭에서 세일별로 <b>픽업 예약 받기</b>를 켜세요.
                </p>
                <MerchantReservations storeId={storeId} onToast={showToast} />
              </div>
            )}

            {section === "coupons" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">쿠폰 발행·관리</h2>
                <CouponSection detail={detail} onToast={showToast} onDone={refresh} />
              </div>
            )}

            {section === "ads" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">성과형 광고 (CPA)</h2>
                <p className="mb-3 text-xs text-ink-3">
                  구독과 별개로, 손님이 갈래요·길찾기를 누를 때만 건당 과금되는 광고예요.
                </p>
                <MerchantAdCampaign storeId={storeId} onToast={showToast} />
              </div>
            )}

            {section === "photos" && (
              <div>
                <h2 className="mb-2 text-sm font-bold">가게 사진</h2>
                <BannerEditor detail={detail} onToast={showToast} refresh={refresh} />
                <p className="mb-1 mt-4 text-xs font-semibold text-ink-3">갤러리 (여러 장)</p>
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
      <p className="mb-1 text-xs font-semibold text-ink-3">메인 사진</p>
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
          className="flex h-28 w-full items-center justify-center rounded-xl bg-surface-2 text-sm text-ink-3 disabled:opacity-50"
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

/** 플랜별 한 줄 혜택 요약(스위처 버튼용). */
const PLAN_BENEFIT: Record<SubPlan, string> = {
  lite: "세일 알림·단골 관리·리뷰 답글·공식 배지",
  sponsor: "마퀴 고정 + 금색 핀 (노출 부스트)",
  pro: "라이트 전체 + 노출 + 확장통계·무제한쿠폰·갤러리·상위노출",
};
/** 스위처에 노출할 플랜 순서(가격 오름차순). */
const PLAN_ORDER: SubPlan[] = ["lite", "sponsor", "pro"];

/** 구독(라이트/스폰서/프로) 상태 + 플랜 변경(3-way) + 해지. */
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

  const changePlan = async (target: SubPlan) => {
    if (!sub) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onToast(data.error || "변경에 실패했어요.");
        return;
      }
      onToast(`${PLAN_LABEL[target]} 플랜으로 변경했어요! 🎉`);
      refresh();
    } catch {
      onToast("네트워크 오류예요. 잠시 후 다시 시도해 주세요.");
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
          <p className="mt-1 text-xs text-ink-3">
            라이트(알림·단골·답글)·스폰서(노출 부스트)·프로(전체)로 가게를 키워보세요.
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

  const current = asSubPlan(sub.plan);
  const currentPrice = PLAN_PRICE_KRW[current];
  const statusLabel =
    sub.status === "trialing" ? "무료체험 중" : sub.status === "past_due" ? "결제 재시도 중" : "이용 중";
  const others = PLAN_ORDER.filter((p) => p !== current);

  const onSwitch = (target: SubPlan) => {
    const up = PLAN_PRICE_KRW[target] > currentPrice;
    const msg = up
      ? sub.status === "trialing"
        ? `${PLAN_LABEL[target]}로 업그레이드할까요? 체험 중엔 추가 청구가 없어요.`
        : `${PLAN_LABEL[target]}로 업그레이드할까요? 남은 기간 차액이 즉시 결제돼요.`
      : `${PLAN_LABEL[target]} 플랜으로 변경할까요? 상위 혜택이 해제되고 다음 결제부터 ${PLAN_PRICE_KRW[
          target
        ].toLocaleString("ko-KR")}원이에요.`;
    if (window.confirm(msg)) changePlan(target);
  };

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold">구독·플랜</h2>
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-amber-800">👑 {PLAN_LABEL[current]} 플랜</p>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-amber-700">{statusLabel}</span>
        </div>
        <p className="mt-1 text-xs text-ink-3">
          다음 결제 예정일 {new Date(sub.nextBillingAt).toLocaleDateString("ko-KR")} ·{" "}
          {currentPrice.toLocaleString("ko-KR")}원/월
        </p>
        <p className="mt-0.5 text-[11px] text-ink-3">{PLAN_BENEFIT[current]}</p>

        {/* 3-way 플랜 변경 */}
        <div className="mt-3 flex flex-col gap-1.5">
          {others.map((target) => {
            const up = PLAN_PRICE_KRW[target] > currentPrice;
            return (
              <button
                key={target}
                type="button"
                disabled={busy}
                onClick={() => onSwitch(target)}
                className={[
                  "rounded-lg border px-3 py-2 text-left text-xs disabled:opacity-50",
                  up
                    ? "border-indigo-200 bg-white hover:bg-indigo-50"
                    : "border-line bg-white hover:bg-surface-2",
                ].join(" ")}
              >
                <span className={`font-bold ${up ? "text-indigo-700" : "text-ink-2"}`}>
                  {up ? "⬆ " : "⬇ "}
                  {PLAN_LABEL[target]}로 변경 ({PLAN_PRICE_KRW[target].toLocaleString("ko-KR")}원/월)
                </span>
                <span className="mt-0.5 block text-[10px] text-ink-3">{PLAN_BENEFIT[target]}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <button
            type="button"
            disabled={busy}
            onClick={cancel}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-3 hover:bg-surface-2 disabled:opacity-50"
          >
            구독 해지
          </button>
        </div>
      </div>
    </div>
  );
}
