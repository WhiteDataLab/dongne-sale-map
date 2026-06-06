import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META, type Category } from "@/lib/constants";
import { asStoreHours, isOpenNow } from "@/lib/businessHours";
import { won, untilLabel, freshnessLabel, starString } from "@/lib/format";
import { ShareButton } from "@/components/ShareButton";

/** 가게별 공유 랜딩 페이지 (외부 공유용). URL: /s/[id] — 지도 없이 세일 정보 바로 노출. */
export const dynamic = "force-dynamic";

async function getStore(id: string) {
  const now = new Date();
  return prisma.store.findUnique({
    where: { id },
    include: {
      sales: {
        where: { status: "active", expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
      },
      reviews: { where: { hidden: false }, select: { rating: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let store: Awaited<ReturnType<typeof getStore>> = null;
  try {
    store = await getStore(id);
  } catch {
    store = null;
  }
  if (!store) return { title: "가게를 찾을 수 없어요 — 동네 세일 지도" };

  const top = store.sales[0];
  const title = `${store.name} 세일 정보 — 동네 세일 지도`;
  const description = top
    ? `🔥 ${top.title} ${won(top.salePrice)} · 지금 진행중인 세일 ${store.sales.length}건`
    : `${store.name}의 메뉴·세일·리뷰를 확인해보세요.`;
  const image = top?.photoUrl || top?.photoUrls?.[0] || store.bannerUrl || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : [],
      type: "website",
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function StoreSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let store: Awaited<ReturnType<typeof getStore>> = null;
  try {
    store = await getStore(id);
  } catch {
    store = null;
  }
  if (!store || store.status !== "active") notFound();

  const meta = CATEGORY_META[store.category as Category];
  const hours = asStoreHours(store.hoursJson);
  const open = isOpenNow(hours, new Date());
  const ratings = store.reviews.map((r) => r.rating);
  const avg =
    ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  const mapHref = `/?store=${store.id}&lat=${store.lat}&lng=${store.lng}`;

  return (
    <div className="mx-auto min-h-full max-w-md bg-white">
      {/* 헤더 */}
      <header
        className="flex flex-col items-center px-6 py-8 text-center"
        style={{ background: `linear-gradient(160deg, ${meta.color}22, ${meta.color}55)` }}
      >
        <span className="text-5xl">{meta.icon}</span>
        <h1 className="mt-2 text-2xl font-bold">{store.name}</h1>
        <p className="mt-1 text-sm text-gray-600">{store.address}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
          {open === true && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">영업중</span>
          )}
          {open === false && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 font-medium text-gray-600">영업종료</span>
          )}
          {avg !== null && (
            <span className="text-amber-500">
              {starString(avg)} <span className="text-gray-400">({ratings.length})</span>
            </span>
          )}
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-gray-600">{meta.label}</span>
        </div>
      </header>

      {/* 세일 */}
      <section className="px-4 py-5">
        <h2 className="mb-3 text-lg font-bold">
          🔥 진행중인 세일 {store.sales.length > 0 && <span className="text-red-600">{store.sales.length}</span>}
        </h2>

        {store.sales.length === 0 ? (
          <p className="rounded-xl border border-gray-100 bg-gray-50 py-10 text-center text-sm text-gray-400">
            지금은 진행중인 세일이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {store.sales.map((s) => {
              const photos = s.photoUrls?.length ? s.photoUrls : s.photoUrl ? [s.photoUrl] : [];
              return (
                <li key={s.id} className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                  {photos.length > 0 && (
                    <div className="flex w-full snap-x snap-mandatory overflow-x-auto">
                      {photos.map((u, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={u}
                          alt=""
                          className="aspect-video w-full shrink-0 snap-center object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold">{s.title}</p>
                      <p className="shrink-0 font-bold text-red-600">{won(s.salePrice)}</p>
                    </div>
                    <p className="text-xs text-gray-500">{s.qty}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600">
                        {untilLabel(s.expiresAt.toISOString())}
                      </span>
                      <span className="text-gray-400">{freshnessLabel(s.createdAt.toISOString())}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* CTA */}
      <div className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white/90 p-3 backdrop-blur">
        <Link
          href={mapHref}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white"
        >
          지도에서 자세히 보기
        </Link>
        <ShareButton
          path={`/s/${store.id}`}
          title={`${store.name} 세일 정보`}
          text="동네 세일 지도에서 확인해보세요!"
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700"
        >
          🔗 공유
        </ShareButton>
      </div>

      <p className="px-4 pb-6 pt-2 text-center text-xs text-gray-400">
        동네 세일 지도 · 우리 동네 실시간 세일을 지도에서
      </p>
    </div>
  );
}
