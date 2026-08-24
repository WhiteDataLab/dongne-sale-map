import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { reviewDateLabel, won } from "@/lib/format";
import { regionFromAddress } from "@/lib/sponsors";
import { getLaunchFlags } from "@/lib/launchFlags";
import { getCurrentUser } from "@/lib/session";
import { NeighborhoodBoard, type NhPostDTO } from "@/components/NeighborhoodBoard";

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
  // P1-10(러브버그맵 랭킹 패턴): 참여=소유감 — 이번 주 제보왕 + 동네별 세일 랭킹
  let topReporters: { nickname: string; count: number }[] = [];
  let hotRegions: { region: string; count: number }[] = [];
  // P1-7 동네 절약방(가벼운 커뮤니티) — flag_community 킬스위치
  let communityOn = true;
  let posts: NhPostDTO[] = [];
  let viewerId: string | null = null;
  let isAdmin = false;
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
        text: `${s.store.name} — ${s.title} ${s.salePrice != null ? `${won(s.salePrice)} ` : ""}세일`,
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

    // 이번 주(7일) 제보왕 top5 — 숨김 제외, 만료돼도 기여는 인정
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const grouped = await prisma.sale.groupBy({
      by: ["createdById"],
      where: { status: "active", createdAt: { gte: weekAgo }, store: { status: "active" } },
      _count: { createdById: true },
      orderBy: { _count: { createdById: "desc" } },
      take: 5,
    });
    if (grouped.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: grouped.map((g) => g.createdById) } },
        select: { id: true, nickname: true },
      });
      const nick = new Map(users.map((u) => [u.id, u.nickname]));
      topReporters = grouped
        .filter((g) => nick.has(g.createdById))
        .map((g) => ({ nickname: nick.get(g.createdById) as string, count: g._count.createdById }));
    }

    // 동네(동)별 진행중 세일 랭킹 top5 — "어디가 핫한지"(히트맵의 리스트판)
    const regionSales = await prisma.sale.findMany({
      where: { status: "active", expiresAt: { gt: now }, store: { status: "active" } },
      select: { store: { select: { address: true } } },
      take: 500,
    });
    const regionCount = new Map<string, number>();
    for (const s of regionSales) {
      const r = regionFromAddress(s.store.address);
      if (r === "구독") continue;
      regionCount.set(r, (regionCount.get(r) ?? 0) + 1);
    }
    hotRegions = [...regionCount.entries()]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 절약방: 플래그 + 최근 글 + 뷰어(본인 글 삭제/관리자 판별)
    communityOn = (await getLaunchFlags()).community;
    if (communityOn) {
      const [rows, viewer] = await Promise.all([
        prisma.neighborhoodPost.findMany({
          where: { hidden: false },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            region: true,
            body: true,
            createdAt: true,
            authorId: true,
            author: { select: { nickname: true } },
          },
        }),
        getCurrentUser(),
      ]);
      posts = rows.map((p) => ({
        id: p.id,
        region: p.region,
        body: p.body,
        nickname: p.author.nickname,
        authorId: p.authorId,
        createdAt: p.createdAt.toISOString(),
      }));
      viewerId = viewer?.id ?? null;
      isAdmin = viewer?.role === "admin";
    }
  } catch {
    // DB 미연결
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-5">
        <Link href="/" className="text-sm text-ink-3">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-ink">동네 소식</h1>
        <p className="text-xs text-ink-3">우리 동네의 최근 세일 · 휴업/폐업 제보 · 새 가게 소식이에요.</p>

        {/* P1-7: 동네 절약방(가벼운 커뮤니티) — 절약을 놀이·연대로(거지맵 거지방) */}
        {communityOn && (
          <NeighborhoodBoard
            posts={posts}
            viewerId={viewerId}
            isAdmin={isAdmin}
            defaultRegion={hotRegions[0]?.region}
          />
        )}

        {/* P1-10: 랭킹 — 참여=소유감(러브버그맵), 어디가 핫한지(히트맵 리스트판) */}
        {(topReporters.length > 0 || hotRegions.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {topReporters.length > 0 && (
              <section className="rounded-2xl border border-line bg-white p-4">
                <h2 className="text-sm font-extrabold text-ink">🏆 이번 주 제보왕</h2>
                <ol className="mt-2 flex flex-col gap-1.5">
                  {topReporters.map((r, i) => (
                    <li key={r.nickname + i} className="flex items-center gap-2 text-sm">
                      <span className="w-6 shrink-0 text-center">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.nickname}</span>
                      <span className="num shrink-0 text-xs font-extrabold text-deal-ink">{r.count}건</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-ink-4">최근 7일 세일 제보 기준 · 제보하면 순위에 올라요!</p>
              </section>
            )}
            {hotRegions.length > 0 && (
              <section className="rounded-2xl border border-line bg-white p-4">
                <h2 className="text-sm font-extrabold text-ink">🔥 지금 세일 많은 동네</h2>
                <ol className="mt-2 flex flex-col gap-1.5">
                  {hotRegions.map((r, i) => (
                    <li key={r.region} className="flex items-center gap-2 text-sm">
                      <span className="w-6 shrink-0 text-center">{i + 1}.</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.region}</span>
                      <span className="num shrink-0 text-xs font-extrabold text-deal-ink">세일 {r.count}건</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-ink-4">지금 진행중인 세일 수 기준</p>
              </section>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
            아직 소식이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.slice(0, 60).map((n) => (
              <li key={n.id}>
                <Link
                  href={`/?store=${n.storeId}&lat=${n.lat}&lng=${n.lng}`}
                  className="flex gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-surface-2"
                >
                  <span className="text-xl" aria-hidden>
                    {n.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{n.text}</p>
                    <p className="mt-0.5 text-xs text-ink-3">{reviewDateLabel(n.createdAt.toISOString())}</p>
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
