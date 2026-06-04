import Link from "next/link";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META, type Category } from "@/lib/constants";

export const metadata = { title: "즐겨찾기 — 동네 세일 지도" };

/**
 * 즐겨찾기 별도 메뉴 (스펙 Phase 7d).
 * 가게별 세일 여부 표시 + 클릭 시 지도(/?store=)로 이동해 위치 무관하게 바로 상세 열람.
 */
export default async function FavoritesPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-gray-500">
        <p className="mt-10">로그인이 필요해요.</p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: "/favorites" });
          }}
        >
          <button className="mt-3 rounded-full bg-[#03C75A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#02b350] active:bg-[#029a45]">
            네이버 로그인
          </button>
        </form>
        <Link href="/" className="mt-4 inline-block text-blue-600">
          ← 지도로
        </Link>
      </div>
    );
  }

  let favs: {
    id: string;
    name: string;
    category: Category;
    address: string;
    lat: number;
    lng: number;
    hasActiveSale: boolean;
  }[] = [];
  try {
    const now = new Date();
    const rows = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            category: true,
            address: true,
            lat: true,
            lng: true,
            status: true,
            _count: {
              select: { sales: { where: { status: "active", expiresAt: { gt: now } } } },
            },
          },
        },
      },
    });
    favs = rows
      .filter((r) => r.store.status === "active")
      .map((r) => ({
        id: r.store.id,
        name: r.store.name,
        category: r.store.category as Category,
        address: r.store.address,
        lat: r.store.lat,
        lng: r.store.lng,
        hasActiveSale: r.store._count.sales > 0,
      }));
  } catch {
    // DB 미연결
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-3 p-5">
        <Link href="/" className="text-sm text-gray-400">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold">즐겨찾기 {favs.length > 0 && `(${favs.length})`}</h1>

        {favs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            아직 즐겨찾기한 가게가 없어요.
            <br />
            지도에서 가게를 열고 ♥ 를 눌러보세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {favs.map((f) => (
              <Link
                key={f.id}
                href={`/?store=${f.id}&lat=${f.lat}&lng=${f.lng}`}
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                <span className="text-xl" aria-hidden>
                  {CATEGORY_META[f.category].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.name}</p>
                  <p className="truncate text-xs text-gray-400">{f.address}</p>
                </div>
                {f.hasActiveSale ? (
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                    🔥 세일중
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-gray-300">세일 없음</span>
                )}
              </Link>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
