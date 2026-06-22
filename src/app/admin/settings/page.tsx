import { getAdminSession } from "@/lib/admin";
import { SettingsGroupForm } from "@/components/SettingsGroupForm";

/** 운영 설정 — 신고 임계·포인트 소멸/조회기간·레이트리밋·물가 표본 등. */
export const dynamic = "force-dynamic";
export const metadata = { title: "운영 설정 — 관리" };

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (!session) return null;
  return (
    <SettingsGroupForm
      group="ops"
      intro="신고 자동숨김 임계, 포인트 소멸/조회 기간, 어뷰징 레이트리밋, 물가 통계 표본 등 운영 수치를 조정해요."
    />
  );
}
