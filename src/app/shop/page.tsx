import Link from "next/link";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPointBalance } from "@/lib/points";
import { getActiveGifts, giftCategoryLabel, GIFT_CATEGORIES, type GiftItem } from "@/lib/gifts";
import { getSponsoredBrandMap } from "@/lib/brands";
import { getLaunchFlags } from "@/lib/launchFlags";
import { RedeemButton } from "@/components/RedeemButton";

/** 포인트샵: 포인트로 기프티콘 교환(커피·디저트·외식·뷰티 등 분류별). 1P = 1원 상당. */
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

  // 무료 오픈 모드: 적립은 계속하되 교환만 잠근다(티저 카탈로그).
  const locked = !(await getLaunchFlags()).pointshop;

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

  // 분류별 그룹핑(프리셋 순서 우선, 미등록 분류는 '기타' 위치로). gifts 는 이미 정렬됨.
  const catRank = (c: string) => {
    const i = (GIFT_CATEGORIES as readonly string[]).indexOf(c);
    return i === -1 ? GIFT_CATEGORIES.length - 1 : i;
  };
  const groupMap = new Map<string, GiftItem[]>();
  for (const g of gifts) {
    const cat = giftCategoryLabel(g.category);
    const arr = groupMap.get(cat);
    if (arr) arr.push(g);
    else groupMap.set(cat, [g]);
  }
  const giftGroups = [...groupMap.entries()].sort((a, b) => catRank(a[0]) - catRank(b[0]));
  // 그룹이 하나뿐이고 '기타'면 분류 헤딩이 어색하므로 일반 라벨을 쓴다.
  const singleUnlabeled = giftGroups.length === 1 && giftGroups[0][0] === "기타";

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

        {/* 무료 오픈 모드: 교환 잠금 티저 — "지금 모아두세요" */}
        {locked && (
          <div className="rounded-2xl border border-dashed border-brand bg-brand-wash p-4 text-center">
            <p className="text-base font-extrabold text-brand-ink">🎁 곧 교환 오픈 예정이에요</p>
            <p className="mt-1 text-sm font-medium text-ink-2">
              지금 포인트를 모아두면 오픈 때 바로 바꿀 수 있어요.
              <br />
              출석·가게/세일 제보·리뷰로 포인트를 쌓아보세요!
            </p>
          </div>
        )}

        {/* 연락처 안내 (교환 가능할 때만) */}
        {!locked && !contact && (
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

        {/* 카탈로그 — 분류별 그룹 */}
        {giftGroups.map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-2 text-base font-bold text-ink">{singleUnlabeled ? "기프티콘" : cat}</h2>
            <div className="grid grid-cols-2 gap-3">
              {list.map((g) => {
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
                      {locked ? (
                        <div className="w-full rounded-lg bg-surface-2 py-2 text-center text-xs font-bold text-ink-3">
                          🔒 곧 오픈
                        </div>
                      ) : (
                        <RedeemButton itemId={g.id} points={g.points} affordable={affordable} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <section className="rounded-2xl bg-white p-4 text-xs text-ink-3 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-ink-2">이용 안내</h2>
          {locked ? (
            <ul className="flex flex-col gap-1">
              <li>· 지금은 <b>포인트 적립</b> 기간이에요. 모은 포인트는 그대로 쌓여 있어요.</li>
              <li>· 교환은 곧 오픈돼요. 오픈하면 1P = 1원 상당 기프티콘으로 바꿀 수 있어요.</li>
              <li>· 포인트는 출석·가게/세일 제보·리뷰·친구 초대로 모을 수 있어요.</li>
            </ul>
          ) : (
            <ul className="flex flex-col gap-1">
              <li>· 포인트 1P = 1원 상당으로 교환돼요.</li>
              <li>· 교환 시 포인트가 차감되고, 영업일 기준 순차적으로 <b>등록한 연락처(문자)</b>로 기프티콘을 보내드려요.</li>
              <li>· 교환 내역은 <Link href="/account" className="underline">마이페이지</Link>에서 볼 수 있어요.</li>
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
