import { ImunConceptDemo } from "@/components/ImunConceptDemo";

// TODO(out-of-scope): 스펙 밖 데모 라우트. DB/실제 지도 연동 없이 목업 데이터만 사용.
export const metadata = { title: "이문동 컨셉 데모 — 동네 세일 지도" };

export default function ImunConceptDemoPage() {
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <ImunConceptDemo />
    </div>
  );
}
