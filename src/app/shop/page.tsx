import Link from "next/link";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPointBalance } from "@/lib/points";
import { getActiveGifts, type GiftItem } from "@/lib/gifts";
import { getSponsoredBrandMap } from "@/lib/brands";
import { RedeemButton } from "@/components/RedeemButton";

/** 포인트샵: 포인트로 커피 기프티콘 교환. (5000P = 5000원 상당) */
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-ink-3">
        <p className="mt-10">포인트샵은 로그인 후 이용할 수 있어요.</p>
        <form
          action={async () => {
            "use server";
            await signIn(undefined, { redirectTo: "/shop" });
          }}
        >
          <button className="mt-3 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white">
            로그인하기
          </button>
        </form>
        <Link href="/" className="mt-4 inline-block text-brand">
          ← 지도로
        </Link>
      </div>
    );
  }

  let balance = 0;
  let contact: string | null = null;
  let gifts: GiftItem[] = [];
  let sponsoredMap = new Map<string, string>();
  try {
    balance = await getPointBalance(session.user.id);
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { contactPhone: true },
    });
    contact = me?.contactPhone ?? null;
    gifts = await getActiveGifts();
    sponsoredMap = await getSponsoredBrandMap(gifts.map((g) => g.id));
  } catch {
    // DB 미연결
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-2">
      <div className="mx-auto flex max-w-md flex-col gap-4 p-5">
        <Link href="/" className="text-sm text-ink-3">
          ← 지도로
        </Link>

        {/* 잔액 */}
        <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-5 text-white shadow-sm">
          <p className="text-xs text-white/70">내 포인트</p>
          <p className="mt-1 text-3xl font-extrabold">{balance.toLocaleString("ko-KR")}P</p>
          <p className="mt-1 text-xs text-white/70">5,000P = 5,000원 상당 기프티콘</p>
        </section>

        {/* 연락처 안내 */}
        {!contact && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-800">📱 수령 연락처를 먼저 등록해 주세요</p>
            <p className="mt-0.5 text-xs text-amber-700">
              기프티콘은 등록한 연락처로 보내드려요.{" "}
              <Link href="/account#contact" className="font-semibold underline">
                연락처 등록하기
              </Link>
            </p>
          </div>
        )}

        {/* 카탈로그 */}
        <section>
          <h1 className="mb-2 text-lg font-bold">커피 기프티콘</h1>
          <div className="grid grid-cols-2 gap-3">
            {gifts.map((g) => {
              const affordable = balance >= g.points && !!contact;
              const sponsorBrand = sponsoredMap.get(g.id);
              return (
                <div key={g.id} className="relative flex flex-col rounded-2xl border border-line-2 bg-white p-3 shadow-sm">
                  {sponsorBrand && (
                    <span className="absolute right-2 top-2 z-10 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      {sponsorBrand} 후원
                    </span>
                  )}
                  <div
                    className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-xl text-4xl"
                    style={{ background: `${g.color}1a` }}
                  >
                    {g.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      g.emoji
                    )}
                  </div>
                  <p className="text-xs text-ink-3">{g.brand}</p>
                  <p className="truncate text-sm font-semibold">{g.name}</p>
                  <p className="mb-2 mt-0.5 font-bold text-brand">{g.points.toLocaleString("ko-KR")}P</p>
                  <div className="mt-auto">
                    <RedeemButton itemId={g.id} points={g.points} affordable={affordable} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 text-xs text-ink-3 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-ink-2">이용 안내</h2>
          <ul className="flex flex-col gap-1">
            <li>· 포인트 1P = 1원 상당으로 교환돼요.</li>
            <li>· 교환 시 포인트가 차감되고, 영업일 기준 순차적으로 <b>등록한 연락처(문자)</b>로 기프티콘을 보내드려요.</li>
            <li>· 교환 내역은 <Link href="/account" className="underline">마이페이지</Link>에서 볼 수 있어요.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
