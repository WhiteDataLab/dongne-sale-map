import Link from "next/link";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureReferralCode, REFERRAL_POINT } from "@/lib/referral";
import { InvitePanel } from "@/components/InvitePanel";

/** 친구 초대(추천인 코드): 친구가 코드로 가입하면 둘 다 +50P. */
export const dynamic = "force-dynamic";

const GRACE_DAYS = 7;

export default async function InvitePage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-gray-500">
        <p className="mt-10">친구 초대는 로그인 후 이용할 수 있어요.</p>
        <form
          action={async () => {
            "use server";
            await signIn(undefined, { redirectTo: "/invite" });
          }}
        >
          <button className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            로그인하기
          </button>
        </form>
        <Link href="/" className="mt-4 inline-block text-blue-600">
          ← 지도로
        </Link>
      </div>
    );
  }

  let code = "";
  let invitedCount = 0;
  let earned = 0;
  let canEnter = false;
  try {
    code = await ensureReferralCode(session.user.id);
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { referredById: true, createdAt: true, _count: { select: { referrals: true } } },
    });
    invitedCount = me?._count.referrals ?? 0;
    const ageDays = me ? (Date.now() - me.createdAt.getTime()) / (24 * 60 * 60 * 1000) : 999;
    canEnter = !!me && !me.referredById && ageDays <= GRACE_DAYS;
    const agg = await prisma.pointLog.aggregate({
      _sum: { amount: true },
      where: { userId: session.user.id, refType: "referral", amount: { gt: 0 } },
    });
    earned = agg._sum.amount ?? 0;
  } catch {
    // DB 미연결
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="mx-auto flex max-w-md flex-col gap-4 p-5">
        <Link href="/" className="text-sm text-gray-400">
          ← 지도로
        </Link>

        <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-5 text-center text-white shadow-sm">
          <p className="text-3xl">🎉</p>
          <h1 className="mt-1 text-xl font-bold">친구 초대 이벤트</h1>
          <p className="mt-1 text-sm text-white/80">
            친구가 내 코드로 가입하면 <b>나와 친구 각각 +{REFERRAL_POINT}P</b>
          </p>
          <div className="mt-3 flex justify-center gap-6 text-sm">
            <div>
              <p className="text-xs text-white/60">초대한 친구</p>
              <p className="text-lg font-bold">{invitedCount}명</p>
            </div>
            <div>
              <p className="text-xs text-white/60">추천으로 받은 P</p>
              <p className="text-lg font-bold">{earned}P</p>
            </div>
          </div>
        </section>

        {code ? (
          <InvitePanel code={code} canEnter={canEnter} />
        ) : (
          <p className="text-center text-sm text-gray-400">추천 코드를 불러오지 못했어요.</p>
        )}

        <section className="rounded-2xl bg-white p-4 text-xs text-gray-500 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">이용 안내</h2>
          <ul className="flex flex-col gap-1">
            <li>· 친구가 초대 링크로 <b>카카오·네이버·전화번호 가입</b>을 완료하면 둘 다 +{REFERRAL_POINT}P.</li>
            <li>· 링크 없이 가입한 친구는 가입 {GRACE_DAYS}일 이내에 코드를 직접 입력하면 돼요.</li>
            <li>· 추천인 등록은 1인당 1회예요. 본인 코드는 사용할 수 없어요.</li>
            <li className="text-gray-400">· 포인트는 적립 대기(표시용)예요.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
