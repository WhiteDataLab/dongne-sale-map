import { ImunConceptDemo } from "@/components/ImunConceptDemo";

// TODO(out-of-scope): 스펙 밖 데모 라우트. 실제 카카오맵 SDK는 쓰지만 가게 데이터는 목업, DB 연동 없음.
export const metadata = { title: "이문동 컨셉 데모 — 동네 세일 지도" };

export default function ImunConceptDemoPage() {
  return (
    <div className="h-full">
      <ImunConceptDemo />
    </div>
  );
}
