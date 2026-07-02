import { MapExplorer } from "@/components/MapExplorer";
import { getLaunchFlags } from "@/lib/launchFlags";

// 런치 플래그(콜드스타트 UI 롤백 토글)를 요청마다 읽어 즉시 반영(재배포 불필요).
export const dynamic = "force-dynamic";

export default async function Home() {
  const flags = await getLaunchFlags();
  return <MapExplorer coldstart={!flags.classicMap} />;
}
