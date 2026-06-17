import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import { getBrandCampaigns } from "@/lib/brands";
import { BrandAdmin } from "@/components/BrandAdmin";

/** L5 — 브랜드 스폰서 리워드 관리(관리자). 기프티콘 원가를 브랜드 광고 매출로 전환. */
export const dynamic = "force-dynamic";
export const metadata = { title: "브랜드 리워드 — 관리" };

export default async function AdminBrandsPage() {
  const session = await getAdminSession();
  if (!session) return null;

  const [campaigns, gifts] = await Promise.all([
    getBrandCampaigns(),
    prisma.giftItem.findMany({
      orderBy: [{ sortOrder: "asc" }],
      take: 100,
      select: { id: true, brand: true, name: true },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">브랜드 스폰서 리워드</h1>
      <p className="mb-3 text-xs text-gray-400">
        브랜드가 기프티콘을 후원하고 상환당 CPA 를 내요. 리워드 원가(변동비)를 브랜드 광고 매출로 전환해요.
      </p>
      <BrandAdmin
        gifts={gifts.map((g) => ({ id: g.id, label: `${g.brand} ${g.name}` }))}
        campaigns={campaigns}
      />
    </div>
  );
}
