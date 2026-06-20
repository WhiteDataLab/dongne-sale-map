import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import {
  SPONSOR_PRICE_KRW,
  LITE_PRICE_KRW,
  PRO_PRICE_KRW,
  TRIAL_DAYS,
  PLAN_LABEL,
  asSubPlan,
  getActiveSubscriptionForStore,
} from "@/lib/sponsors";
import { isTossConfigured, tossClientKey } from "@/lib/toss";
import { SponsorSubscribeButton } from "@/components/SponsorSubscribeButton";

/** M2·M4 — 사장님 셀프 구독: 스폰서/프로 플랜 카드 등록(빌링키) → 14일 무료 후 월 자동결제. */
export const dynamic = "force-dynamic";
export const metadata = { title: "스폰서·프로 구독 — 동네 세일 지도" };

export default async function SponsorSubscribePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const store = await prisma.store
    .findUnique({ where: { id }, select: { id: true, name: true, address: true, ownerId: true } })
    .catch(() => null);

  const shell = (children: React.ReactNode) => (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md p-5">
        <Link href="/" className="text-xs font-medium text-ink-3">← 지도로</Link>
        {children}
      </div>
    </div>
  );

  if (!store) return shell(<p className="mt-10 text-center text-sm text-ink-3">가게를 찾을 수 없어요.</p>);
  if (!canManageStore(store, user)) {
    return shell(
      <p className="mt-10 text-center text-sm text-ink-3">
        이 가게의 <b>사장님(소유자)</b>만 구독할 수 있어요.
      </p>,
    );
  }

  const active = await getActiveSubscriptionForStore(id);
  if (active) {
    return shell(
      <div className="mt-8 text-center">
        <p className="text-2xl">👑</p>
        <p className="mt-2 font-semibold">
          이미 {PLAN_LABEL[asSubPlan(active.plan)]} 플랜 구독 중이에요
        </p>
        <p className="mt-1 text-sm text-ink-3">
          다음 결제 예정일: {new Date(active.nextBillingAt).toLocaleDateString("ko-KR")}
        </p>
        <Link href="/" className="mt-4 inline-block font-bold text-brand">← 지도로 돌아가기</Link>
      </div>,
    );
  }

  const configured = isTossConfigured();
  const clientKey = tossClientKey();

  return shell(
    <div className="mt-4 flex flex-col gap-3.5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">우리 가게 홍보 구독</h1>
        <p className="mt-1 text-sm font-medium text-ink-2">{store.name}</p>
        <p className="mt-2 inline-block rounded-full bg-deal-wash px-2.5 py-1 text-xs font-bold text-deal-ink">
          🎁 유료 플랜 모두 {TRIAL_DAYS}일 무료체험 · 체험 중 해지하면 청구 없어요
        </p>
      </div>

      {/* FREE 기준선 — 가격 앵커링(지금도 무료로 올라간다) */}
      <div className="rounded-2xl border border-line bg-surface-2 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-extrabold tracking-wide text-ink-3">FREE</p>
          <p className="num text-sm font-extrabold text-ink-3">0원</p>
        </div>
        <p className="mt-1 text-[15px] font-bold tracking-tight text-ink-2">게시판에 올라가요</p>
        <p className="mt-1 text-xs font-medium text-ink-3">인증·메뉴·세일·쿠폰 기본 — 지금도 무료예요</p>
      </div>

      {/* 라이트 — 가장 인기(블루 강조, 추천 띠) */}
      <div className="relative rounded-2xl border-2 border-brand bg-white p-4 shadow-[0_8px_24px_rgba(49,130,246,0.12)]">
        <span className="absolute -top-2.5 right-4 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-extrabold text-white">
          가장 인기
        </span>
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-extrabold tracking-wide text-brand-ink">LITE</p>
          <p>
            <b className="num text-2xl font-extrabold text-ink">{LITE_PRICE_KRW.toLocaleString("ko-KR")}</b>
            <span className="text-xs font-bold text-ink-3"> 원/월</span>
          </p>
        </div>
        <p className="mt-1 text-[15px] font-bold tracking-tight text-ink">손님에게 먼저 연락해요</p>
        <ul className="mt-2.5 space-y-1.5 text-sm text-ink-2">
          <li>🔔 <b className="font-bold text-ink">세일 알림 발송</b> (즐겨찾기 단골에게)</li>
          <li>🧑‍🤝‍🧑 <b className="font-bold text-ink">단골 식별</b> + ⭐ <b className="font-bold text-ink">리뷰 답글</b></li>
          <li>✅ <b className="font-bold text-ink">공식 배지</b> (소비자 신뢰)</li>
          <li>🎟️ 쿠폰 활성 50개</li>
        </ul>
        <p className="mt-2 text-[11px] font-medium text-ink-3">※ 지도 노출 부스트(마퀴·금색핀)는 스폰서/프로에 포함돼요.</p>
        {configured && clientKey ? (
          <SponsorSubscribeButton storeId={id} clientKey={clientKey} plan="lite" label="라이트로 시작" tone="primary" />
        ) : null}
      </div>

      {/* 스폰서 — 노출 부스트(중립) */}
      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-extrabold tracking-wide text-ink-3">SPONSOR</p>
          <p>
            <b className="num text-2xl font-extrabold text-ink">{SPONSOR_PRICE_KRW.toLocaleString("ko-KR")}</b>
            <span className="text-xs font-bold text-ink-3"> 원/월</span>
          </p>
        </div>
        <p className="mt-1 text-[15px] font-bold tracking-tight text-ink">지도에서 눈에 띄어요</p>
        <ul className="mt-2.5 space-y-1.5 text-sm text-ink-2">
          <li>📣 지도 상단 광고판(마퀴) <b className="font-bold text-ink">상단 고정</b></li>
          <li>👑 지도에서 눈에 띄는 <b className="font-bold text-ink">금색 핀</b></li>
        </ul>
        {configured && clientKey ? (
          <SponsorSubscribeButton storeId={id} clientKey={clientKey} plan="sponsor" label="스폰서로 시작" tone="neutral" />
        ) : null}
      </div>

      {/* 프로 — 최상위 앵커(다크 카드) */}
      <div
        className="relative rounded-2xl border border-transparent p-4 text-white"
        style={{ background: "linear-gradient(180deg,#10243F,#0B1A2E)" }}
      >
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-extrabold tracking-wide text-[#9DC2FF]">PRO</p>
          <p>
            <b className="num text-2xl font-extrabold text-white">{PRO_PRICE_KRW.toLocaleString("ko-KR")}</b>
            <span className="text-xs font-bold text-[#7E9ECB]"> 원/월</span>
          </p>
        </div>
        <p className="mt-1 text-[15px] font-bold tracking-tight text-white">단골을 데이터로 관리해요</p>
        <ul className="mt-2.5 space-y-1.5 text-sm text-[#B8C7DD]">
          <li>👑 <b className="font-bold text-white">스폰서 혜택 전부</b> (마퀴 고정 + 금색 핀)</li>
          <li>📊 <b className="font-bold text-white">확장 통계</b> (30·90일 추이 + 요일별)</li>
          <li>🎟️ <b className="font-bold text-white">쿠폰 무제한</b> + 지도 쿠폰 배지</li>
          <li>🖼️ 가게 <b className="font-bold text-white">사진 갤러리</b> (여러 장)</li>
          <li>🔝 검색·목록 <b className="font-bold text-white">상위 노출</b></li>
        </ul>
        {configured && clientKey ? (
          <SponsorSubscribeButton storeId={id} clientKey={clientKey} plan="pro" label="프로로 시작" tone="dark" />
        ) : null}
      </div>

      {!(configured && clientKey) && (
        <p className="rounded-xl bg-surface-2 p-3 text-center text-sm font-medium text-ink-3">
          결제 기능 준비중이에요. 잠시만 기다려 주세요. 🙏
        </p>
      )}

      <p className="text-xs leading-relaxed text-ink-3">
        · 카드 등록 후 {TRIAL_DAYS}일간 무료로 노출돼요. 무료체험 종료 전 해지하면 청구되지 않아요.
        <br />· 해지 시 다음 결제부터 중단되며, 이미 결제한 기간의 노출은 만료일까지 유지돼요(환불 없음).
        <br />· 카드 정보는 토스페이먼츠가 안전하게 보관하며, 본 서비스는 카드번호를 저장하지 않아요.
      </p>
    </div>,
  );
}
