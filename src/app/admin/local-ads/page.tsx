import { getAdminSession } from "@/lib/admin";
import { getLocalAds } from "@/lib/localAds";
import { LocalAdAdmin } from "@/components/LocalAdAdmin";

/** L4 — 지역 광고 플랫폼 관리(관리자). 식료품 밖 로컬 광고주의 동네 타게팅 정액 광고. */
export const dynamic = "force-dynamic";
export const metadata = { title: "지역 광고 — 관리" };

export default async function AdminLocalAdsPage() {
  const session = await getAdminSession();
  if (!session) return null;
  const ads = await getLocalAds();

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">지역 광고 플랫폼</h1>
      <p className="mb-3 text-xs text-ink-3">
        부동산·학원·병원 등 로컬 광고주에게 동네 타게팅 정액 광고를 판매해요. 보이는 가게의 동(洞)에 매칭돼 지도 상단에 노출돼요.
      </p>
      <LocalAdAdmin ads={ads} />
    </div>
  );
}
