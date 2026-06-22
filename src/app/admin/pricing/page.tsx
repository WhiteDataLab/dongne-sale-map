import { getAdminSession } from "@/lib/admin";
import { SettingsGroupForm } from "@/components/SettingsGroupForm";

/** 사장님 요금·한도 — 구독 가격·체험/결제주기·티어별 쿠폰/알림/갤러리 한도. */
export const dynamic = "force-dynamic";
export const metadata = { title: "사장님 요금·한도 — 관리" };

export default async function AdminPricingPage() {
  const session = await getAdminSession();
  if (!session) return null;
  return (
    <SettingsGroupForm
      group="pricing"
      intro="스폰서·라이트·프로 구독 가격, 무료체험/결제주기, 티어별 쿠폰·알림·갤러리 한도를 조정해요. (현재 무료 오픈 모드면 사장님 유료 진입점은 숨겨져 있어요.)"
    />
  );
}
