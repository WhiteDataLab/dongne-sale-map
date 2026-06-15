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
        <Link href="/" className="text-xs text-gray-400">← 지도로</Link>
        {children}
      </div>
    </div>
  );

  if (!store) return shell(<p className="mt-10 text-center text-sm text-gray-500">가게를 찾을 수 없어요.</p>);
  if (!canManageStore(store, user)) {
    return shell(
      <p className="mt-10 text-center text-sm text-gray-500">
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
        <p className="mt-1 text-sm text-gray-500">
          다음 결제 예정일: {new Date(active.nextBillingAt).toLocaleDateString("ko-KR")}
        </p>
        <Link href="/" className="mt-4 inline-block text-blue-600">← 지도로 돌아가기</Link>
      </div>,
    );
  }

  const configured = isTossConfigured();
  const clientKey = tossClientKey();

  return shell(
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">👑 우리 가게 홍보 구독</h1>
        <p className="mt-1 text-sm text-gray-500">{store.name}</p>
        <p className="mt-1 text-xs text-amber-700">🎁 두 플랜 모두 <b>{TRIAL_DAYS}일 무료체험</b> · 체험 중 해지하면 청구되지 않아요.</p>
      </div>

      {/* 라이트 플랜 — 관계(알림·단골·답글) 진입 티어 */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold text-emerald-800">라이트</p>
          <p className="text-sm">
            <b className="text-base">{LITE_PRICE_KRW.toLocaleString("ko-KR")}원</b>
            <span className="text-gray-400"> / 월</span>
          </p>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          <li>· 🔔 <b>세일 알림 발송</b> (즐겨찾기 단골에게)</li>
          <li>· 🧑‍🤝‍🧑 <b>단골 식별</b> + ⭐ <b>리뷰 답글</b></li>
          <li>· ✅ <b>공식 배지</b> (소비자 신뢰)</li>
          <li>· 🎟️ 쿠폰 활성 50개</li>
        </ul>
        <p className="mt-1 text-[11px] text-gray-400">※ 지도 노출 부스트(마퀴·금색핀)는 스폰서/프로에 포함돼요.</p>
        {configured && clientKey ? (
          <SponsorSubscribeButton storeId={id} clientKey={clientKey} plan="lite" label="라이트로 시작" />
        ) : null}
      </div>

      {/* 스폰서 플랜 */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold text-amber-800">스폰서</p>
          <p className="text-sm">
            <b className="text-base">{SPONSOR_PRICE_KRW.toLocaleString("ko-KR")}원</b>
            <span className="text-gray-400"> / 월</span>
          </p>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          <li>· 지도 상단 광고판(마퀴) <b>상단 고정</b></li>
          <li>· 지도에서 눈에 띄는 <b>금색 핀(👑)</b></li>
        </ul>
        {configured && clientKey ? (
          <SponsorSubscribeButton storeId={id} clientKey={clientKey} plan="sponsor" label="스폰서로 시작" />
        ) : null}
      </div>

      {/* 프로 플랜 (추천) */}
      <div className="relative rounded-2xl border-2 border-indigo-300 bg-indigo-50/50 p-4">
        <span className="absolute -top-2.5 right-4 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
          추천
        </span>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold text-indigo-700">프로</p>
          <p className="text-sm">
            <b className="text-base">{PRO_PRICE_KRW.toLocaleString("ko-KR")}원</b>
            <span className="text-gray-400"> / 월</span>
          </p>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          <li>· <b>스폰서 혜택 전부</b> (마퀴 고정 + 금색 핀)</li>
          <li>· 📊 <b>확장 통계</b> (30·90일 추이 + 요일별 분석)</li>
          <li>· 🎟️ <b>쿠폰 무제한</b> 발행 + 지도 쿠폰 배지</li>
          <li>· 🖼️ 가게 <b>사진 갤러리</b> (여러 장)</li>
          <li>· 🔝 검색·목록 <b>상위 노출</b></li>
        </ul>
        {configured && clientKey ? (
          <SponsorSubscribeButton storeId={id} clientKey={clientKey} plan="pro" label="프로로 시작" accent />
        ) : null}
      </div>

      {!(configured && clientKey) && (
        <p className="rounded-xl bg-gray-100 p-3 text-center text-sm text-gray-500">
          결제 기능 준비중이에요. 잠시만 기다려 주세요. 🙏
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400">
        · 카드 등록 후 {TRIAL_DAYS}일간 무료로 노출돼요. 무료체험 종료 전 해지하면 청구되지 않아요.
        <br />· 해지 시 다음 결제부터 중단되며, 이미 결제한 기간의 노출은 만료일까지 유지돼요(환불 없음).
        <br />· 카드 정보는 토스페이먼츠가 안전하게 보관하며, 본 서비스는 카드번호를 저장하지 않아요.
      </p>
    </div>,
  );
}
