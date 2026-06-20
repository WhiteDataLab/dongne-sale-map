import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META, type Category } from "@/lib/constants";

export const metadata = { title: "내 가게 관리 — 동네 세일 지도" };
export const dynamic = "force-dynamic";

/** M6 — 사장님 전용 관리 진입. 소유 가게가 1개면 바로 대시보드로, 여러 개면 선택. */
export default async function ManageIndexPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-ink-3">
        <p className="mt-10">로그인이 필요해요.</p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: "/manage" });
          }}
        >
          <button className="mt-3 rounded-full bg-[#03C75A] px-4 py-2 text-sm font-medium text-white hover:bg-[#02b350]">
            네이버 로그인
          </button>
        </form>
        <Link href="/" className="mt-4 inline-block text-brand">← 지도로</Link>
      </div>
    );
  }

  let stores: { id: string; name: string; category: Category; address: string }[] = [];
  try {
    const rows = await prisma.store.findMany({
      where: { ownerId: session.user.id, status: "active" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, category: true, address: true },
    });
    stores = rows.map((r) => ({ ...r, category: r.category as Category }));
  } catch {
    // DB 미연결
  }

  if (stores.length === 1) redirect(`/manage/${stores[0].id}`);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-3 p-5">
        <Link href="/" className="text-sm text-ink-3">← 지도로</Link>
        <h1 className="text-xl font-bold">내 가게 관리</h1>

        {stores.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
            <p>아직 내 소유로 인증된 가게가 없어요.</p>
            <p className="mt-1 text-xs text-ink-3">
              지도에서 내 가게를 찾아 <b>사장님 인증</b>을 신청하면 관리 권한이 생겨요.
            </p>
            <Link href="/" className="mt-3 inline-block rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white">
              지도에서 내 가게 찾기
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {stores.map((s) => (
              <Link
                key={s.id}
                href={`/manage/${s.id}`}
                className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-surface-2"
              >
                <span className="text-xl" aria-hidden>{CATEGORY_META[s.category].icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="truncate text-xs text-ink-3">{s.address}</p>
                </div>
                <span className="shrink-0 text-sm text-ink-4">관리 →</span>
              </Link>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
