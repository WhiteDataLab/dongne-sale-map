import { StoreCreateForm } from "@/components/StoreCreateForm";

export const metadata = { title: "가게 등록 — 동네 세일 지도" };

export default function NewStorePage() {
  return (
    <div className="h-full overflow-y-auto">
      <StoreCreateForm />
    </div>
  );
}
