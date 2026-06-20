import { prisma } from "@/lib/prisma";
import { GiftAdmin } from "@/components/GiftAdmin";

/** 기프티콘 상품 관리 (관리자): 추가/수정/삭제/이미지 업로드. */
export const dynamic = "force-dynamic";

export default async function AdminGifts() {
  let items: Awaited<ReturnType<typeof prisma.giftItem.findMany>> = [];
  let dbError = false;
  try {
    items = await prisma.giftItem.findMany({ orderBy: [{ sortOrder: "asc" }, { points: "asc" }] });
  } catch {
    dbError = true;
  }

  if (dbError) {
    return <p className="py-10 text-center text-sm text-ink-3">상품을 불러오지 못했어요.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold">기프티콘 상품 관리</h2>
        <p className="text-xs text-ink-3">포인트샵(/shop)에 노출되는 상품이에요. 포인트 = 원.</p>
      </div>
      <GiftAdmin items={items} />
    </div>
  );
}
