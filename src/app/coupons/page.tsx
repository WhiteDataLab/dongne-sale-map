import Link from "next/link";
import { auth, signIn } from "@/auth";
import { getMyCoupons } from "@/lib/coupons";
import { MyCouponList } from "@/components/MyCouponList";

export const metadata = { title: "내 쿠폰 — 동네 세일 지도" };
export const dynamic = "force-dynamic";

/** M3 — 내 쿠폰함. 받은 쿠폰을 사용가능/사용완료/만료로 보여주고, 매장에서 사용 처리. */
export default async function MyCouponsPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-ink-3">
        <p className="mt-10">로그인이 필요해요.</p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: "/coupons" });
          }}
        >
          <button className="mt-3 rounded-full bg-[#03C75A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#02b350] active:bg-[#029a45]">
            네이버 로그인
          </button>
        </form>
        <Link href="/" className="mt-4 inline-block text-brand">
          ← 지도로
        </Link>
      </div>
    );
  }

  let coupons: Awaited<ReturnType<typeof getMyCoupons>> = [];
  try {
    coupons = await getMyCoupons(session.user.id);
  } catch {
    // DB 미연결
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-3 p-5">
        <Link href="/" className="text-sm text-ink-3">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold">내 쿠폰 {coupons.length > 0 && `(${coupons.length})`}</h1>
        <MyCouponList initial={coupons} />
      </div>
    </div>
  );
}
