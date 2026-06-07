import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { reviewDateLabel, won } from "@/lib/format";

export const metadata = { title: "동네 소식 — 동네 세일 지도" };
export const dynamic = "force-dynamic";

type NewsItem = {
  id: string;
  icon: string;
  text: string;
  storeId: string;
  lat: number;
  lng: number;
  createdAt: Date;
};

/**
 * 동네 소식 (P2, lite). 별도 모델 없이 최근 세일·휴업/폐업 제보·신규 가게를 한 피드로 모아 보여준다.
 * 클릭 시 지도에서 해당 가게를 연다.
 */
export default async function NewsPage() {
  const items: NewsItem[] = [];
  try {
    const now = new Date();
    const [sales, closures, stores] = await Promise.all([
      prisma.sale.findMany({
        where: { status: "active", expiresAt: { gt: now }, store: { status: "active" } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          salePrice: true,
          createdAt: true,
          store: { select: { id: true, name: true, lat: true, lng: true } },
        },
      }),
      prisma.closureReport.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 14 * 86400000) }, store: { status: "active" } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          kind: true,
          createdAt: true,
          store: { select: { id: true, name: true, lat: true, lng: true } },
        },
      }),
      prisma.store.findMany({
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, name: true, lat: true, lng: true, createdAt: true },
      }),
    ]);

    for (const s of sales)
      items.push({
        id: `sale-${s.id}`,
        icon: "🔥",
        text: `${s.store.name} — ${s.title} ${won(s.salePrice)} 세일`,
        storeId: s.store.id,
        lat: s.store.lat,
        lng: s.store.lng,
        createdAt: s.createdAt,
      });
    for (const c of closures)
      items.push({
        id: `clo-${c.id}`,
        icon: c.kind === "shutdown" ? "🚫" : "⚠️",
        text: `${c.store.name} — ${c.kind === "shutdown" ? "폐업" : "오늘 휴업"} 제보`,
        storeId: c.store.id,
        lat: c.store.lat,
        lng: c.store.lng,
        createdAt: c.createdAt,
      });
    for (const st of stores)
      items.push({
        id: `store-${st.id}`,
        icon: "🏪",
        text: `${st.name} — 새 가게가 등록됐어요`,
        storeId: st.id,
        lat: st.lat,
        lng: st.lng,
        createdAt: st.createdAt,
      });
  } catch {
    // DB 미연결
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-5">
        <Link href="/" className="text-sm text-gray-400">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">동네 소식</h1>
        <p className="text-xs text-gray-400">우리 동네의 최근 세일 · 휴업/폐업 제보 · 새 가게 소식이에요.</p>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            아직 소식이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.slice(0, 60).map((n) => (
              <li key={n.id}>
                <Link
                  href={`/?store=${n.storeId}&lat=${n.lat}&lng=${n.lng}`}
                  className="flex gap-3 rounded-xl border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                >
                  <span className="text-xl" aria-hidden>
                    {n.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800">{n.text}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{reviewDateLabel(n.createdAt.toISOString())}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
