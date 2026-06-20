import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META, type Category } from "@/lib/constants";
import { asStoreHours, openStatusNow } from "@/lib/businessHours";
import { won, untilLabel, freshnessLabel, starString } from "@/lib/format";
import { ShareButton } from "@/components/ShareButton";
import { Reveal } from "@/components/Reveal";

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

  // OG/트위터 이미지는 동적 카드(opengraph-image.tsx)가 자동 생성·연결한다.
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
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
  const openStatus = openStatusNow(hours, new Date());
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
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{store.name}</h1>
        <p className="mt-1 text-sm font-medium text-ink-2">{store.address}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
          {openStatus === "open" && (
            <span className="rounded-full bg-verify-wash px-2 py-0.5 font-bold text-verify-ink">영업중</span>
          )}
          {openStatus === "preparing" && (
            <span className="rounded-full bg-deal-wash px-2 py-0.5 font-bold text-deal-ink">영업준비중</span>
          )}
          {openStatus === "closed" && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-bold text-ink-3">영업종료</span>
          )}
          {avg !== null && (
            <span className="num font-bold text-amber-500">
              {starString(avg)} <span className="text-ink-4">({ratings.length})</span>
            </span>
          )}
          <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold text-ink-2">{meta.label}</span>
        </div>
      </header>

      {/* 세일 */}
      <section className="px-4 py-5">
        <h2 className="mb-3 text-lg font-extrabold tracking-tight text-ink">
          🔥 진행중인 세일 {store.sales.length > 0 && <span className="num text-deal-ink">{store.sales.length}</span>}
        </h2>

        {store.sales.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface-2 py-10 text-center text-sm font-medium text-ink-3">
            지금은 진행중인 세일이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {store.sales.map((s, i) => {
              const photos = s.photoUrls?.length ? s.photoUrls : s.photoUrl ? [s.photoUrl] : [];
              return (
                <li key={s.id}>
                  <Reveal delay={Math.min(i, 6) * 70}>
                    <div className="overflow-hidden rounded-2xl border border-line shadow-[var(--sh-1)]">
                      {photos.length > 0 && (
                        <div className="flex w-full snap-x snap-mandatory overflow-x-auto">
                          {photos.map((u, idx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={idx}
                              src={u}
                              alt=""
                              className="aspect-video w-full shrink-0 snap-center object-cover"
                            />
                          ))}
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate font-bold text-ink">{s.title}</p>
                          <p className="num shrink-0 text-lg font-extrabold text-deal-ink">{won(s.salePrice)}</p>
                        </div>
                        {s.qty?.trim() && <p className="text-xs font-medium text-ink-3">{s.qty}</p>}
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="rounded-full bg-deal-wash px-2 py-0.5 font-bold text-deal-ink">
                            {untilLabel(s.expiresAt.toISOString())}
                          </span>
                          <span className="font-medium text-ink-4">{freshnessLabel(s.createdAt.toISOString())}</span>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* CTA */}
      <div className="sticky bottom-0 flex gap-2 border-t border-line-2 bg-white/90 p-3 backdrop-blur">
        <Link
          href={mapHref}
          className="flex-1 rounded-xl bg-brand py-3 text-center text-sm font-bold text-white hover:bg-brand-ink"
        >
          지도에서 자세히 보기
        </Link>
        <ShareButton
          path={`/s/${store.id}`}
          title={`${store.name} 세일 정보`}
          text="동네 세일 지도에서 확인해보세요!"
          className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-bold text-ink"
        >
          🔗 공유
        </ShareButton>
      </div>

      <p className="px-4 pb-6 pt-2 text-center text-xs font-medium text-ink-4">
        동네 세일 지도 · 우리 동네 실시간 세일을 지도에서
      </p>
    </div>
  );
}
