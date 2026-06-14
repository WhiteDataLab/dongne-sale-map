import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import { MerchantDashboard } from "@/components/MerchantDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "가게 관리 — 동네 세일 지도" };

/** M6 — 사장님 전용 풀페이지 관리 콘솔. 소유자(사장님)·관리자만. */
export default async function ManageStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const store = await prisma.store
    .findUnique({ where: { id }, select: { id: true, name: true, ownerId: true, status: true } })
    .catch(() => null);

  if (!store || store.status !== "active") notFound();
  if (!user || !canManageStore(store, user)) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-gray-500">
        <p className="mt-10">이 가게의 <b>사장님(소유자)</b>만 관리할 수 있어요.</p>
        <Link href="/" className="mt-4 inline-block text-blue-600">← 지도로</Link>
      </div>
    );
  }

  return <MerchantDashboard storeId={id} storeName={store.name} />;
}
