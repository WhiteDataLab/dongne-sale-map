import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import {
  TRIAL_DAYS,
  PLAN_LABEL,
  asSubPlan,
  regionFromAddress,
  getActiveSubscriptionForStore,
  createTrialSubscription,
} from "@/lib/sponsors";
import { issueBillingKey } from "@/lib/toss";

/**
 * M2 — 토스 카드 인증 성공 콜백.
 * 토스가 ?authKey=&customerKey= 를 붙여 리다이렉트 → 서버에서 빌링키 발급 + 14일 무료체험 구독 생성.
 */
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md p-5 text-center">{children}</div>
    </div>
  );
}

export default async function SponsorSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ authKey?: string; customerKey?: string; plan?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const authKey = typeof sp.authKey === "string" ? sp.authKey : "";
  const customerKey = typeof sp.customerKey === "string" ? sp.customerKey : "";
  const plan = asSubPlan(sp.plan);

  const user = await getCurrentUser();
  const store = await prisma.store
    .findUnique({ where: { id }, select: { id: true, name: true, address: true, ownerId: true } })
    .catch(() => null);

  if (!store || !canManageStore(store, user) || !user) {
    return (
      <Shell>
        <p className="mt-10 text-sm text-ink-3">권한이 없거나 가게를 찾을 수 없어요.</p>
        <Link href="/" className="mt-4 inline-block text-brand">← 지도로</Link>
      </Shell>
    );
  }

  if (!authKey || !customerKey) {
    return (
      <Shell>
        <p className="mt-10 text-sm text-ink-3">결제 정보가 올바르지 않아요.</p>
        <Link href={`/stores/${id}/sponsor`} className="mt-4 inline-block text-brand">다시 시도</Link>
      </Shell>
    );
  }

  // 이미 구독 중이면 중복 발급 방지(뒤로가기·새로고침 대비).
  const existing = await getActiveSubscriptionForStore(id);
  if (existing) {
    return (
      <Shell>
        <p className="mt-10 text-2xl">👑</p>
        <p className="mt-2 font-semibold">이미 스폰서 구독 중이에요</p>
        <Link href="/" className="mt-4 inline-block text-brand">← 지도로</Link>
      </Shell>
    );
  }

  let ok = false;
  let errMsg = "";
  try {
    const issued = await issueBillingKey(authKey, customerKey);
    await createTrialSubscription({
      storeId: id,
      userId: user.id,
      customerKey,
      billingKey: issued.billingKey,
      region: regionFromAddress(store.address),
      plan,
    });
    ok = true;
  } catch (e) {
    errMsg = e instanceof Error ? e.message : "구독 생성 중 오류가 발생했어요.";
  }

  if (!ok) {
    return (
      <Shell>
        <p className="mt-10 text-2xl">😢</p>
        <p className="mt-2 font-semibold">구독을 시작하지 못했어요</p>
        <p className="mt-1 text-xs text-ink-3">{errMsg}</p>
        <Link href={`/stores/${id}/sponsor`} className="mt-4 inline-block text-brand">다시 시도</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="mt-10 text-3xl">🎉</p>
      <p className="mt-2 text-lg font-bold">{PLAN_LABEL[plan]} 플랜 구독이 시작됐어요!</p>
      <p className="mt-1 text-sm text-ink-2">{store.name}</p>
      <p className="mt-3 text-sm text-ink-3">
        {plan === "lite" ? (
          <>
            지금부터 <b>{TRIAL_DAYS}일간 무료</b>로 세일 알림 발송·단골 식별·리뷰 답글·공식 배지를 쓸 수 있어요.
          </>
        ) : (
          <>
            지금부터 <b>{TRIAL_DAYS}일간 무료</b>로 마퀴 상단 고정 + 금색 핀(👑)
            {plan === "pro" && " + 프로 프리미엄 혜택"}이 노출돼요.
          </>
        )}
        <br />무료체험이 끝나면 매월 자동결제됩니다.
      </p>
      <Link
        href="/"
        className={`mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${plan === "pro" ? "bg-indigo-600" : plan === "lite" ? "bg-emerald-600" : "bg-amber-500"}`}
      >
        지도에서 확인하기
      </Link>
    </Shell>
  );
}
