import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import {
  SPONSOR_PRICE_KRW,
  TRIAL_DAYS,
  getActiveSubscriptionForStore,
} from "@/lib/sponsors";
import { isTossConfigured, tossClientKey } from "@/lib/toss";
import { SponsorSubscribeButton } from "@/components/SponsorSubscribeButton";

/** M2(수익화) — 사장님 셀프 스폰서 구독: 카드 등록(빌링키) → 14일 무료 후 월 자동결제. */
export const dynamic = "force-dynamic";
export const metadata = { title: "스폰서 구독 — 동네 세일 지도" };

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
        이 가게의 <b>사장님(소유자)</b>만 스폰서를 구독할 수 있어요.
      </p>,
    );
  }

  const active = await getActiveSubscriptionForStore(id);
  if (active) {
    return shell(
      <div className="mt-8 text-center">
        <p className="text-2xl">👑</p>
        <p className="mt-2 font-semibold">이미 스폰서 구독 중이에요</p>
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
    <div className="mt-4">
      <h1 className="text-lg font-bold">👑 스폰서 광고 구독</h1>
      <p className="mt-1 text-sm text-gray-500">{store.name}</p>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="text-sm font-semibold text-amber-800">묶음 상품</p>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          <li>· 지도 상단 광고판(마퀴) <b>상단 고정</b></li>
          <li>· 지도에서 눈에 띄는 <b>금색 핀(👑)</b></li>
        </ul>
        <div className="mt-3 border-t border-amber-200 pt-3">
          <p className="text-sm">
            <b className="text-lg">{SPONSOR_PRICE_KRW.toLocaleString("ko-KR")}원</b>
            <span className="text-gray-500"> / 월</span>
          </p>
          <p className="text-xs text-amber-700">
            🎁 <b>{TRIAL_DAYS}일 무료체험</b> — 체험 기간엔 청구되지 않고, 종료 후 매월 자동결제돼요.
          </p>
        </div>
      </div>

      {configured && clientKey ? (
        <SponsorSubscribeButton storeId={id} clientKey={clientKey} />
      ) : (
        <p className="mt-4 rounded-xl bg-gray-100 p-3 text-center text-sm text-gray-500">
          결제 기능 준비중이에요. 잠시만 기다려 주세요. 🙏
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        · 카드 등록 후 {TRIAL_DAYS}일간 무료로 노출돼요. 무료체험 종료 전 해지하면 청구되지 않아요.
        <br />· 해지 시 다음 결제부터 중단되며, 이미 결제한 기간의 노출은 만료일까지 유지돼요(환불 없음).
        <br />· 카드 정보는 토스페이먼츠가 안전하게 보관하며, 본 서비스는 카드번호를 저장하지 않아요.
      </p>
    </div>,
  );
}
