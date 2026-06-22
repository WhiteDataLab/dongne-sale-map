import { getAdminSession } from "@/lib/admin";
import { SettingsGroupForm } from "@/components/SettingsGroupForm";

/** 광고·예약 파라미터 — 광고 입찰/예산 범위, 브랜드 CPA, 예약 수량·픽업 수수료율. */
export const dynamic = "force-dynamic";
export const metadata = { title: "광고·예약 파라미터 — 관리" };

export default async function AdminParamsPage() {
  const session = await getAdminSession();
  if (!session) return null;
  return (
    <SettingsGroupForm
      group="params"
      intro="성과형 광고 입찰/예산 범위, 브랜드 리워드 CPA, 1회 예약 최대 수량과 픽업 수수료율을 조정해요."
    />
  );
}
