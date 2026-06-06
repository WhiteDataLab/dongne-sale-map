import { prisma } from "@/lib/prisma";

// 포인트샵 기프티콘 카탈로그 — DB(GiftItem) 기반, 관리자 CRUD. 포인트 = 원.

export type GiftItem = {
  id: string;
  brand: string;
  name: string;
  points: number;
  imageUrl: string | null;
  emoji: string;
  color: string;
  active: boolean;
  sortOrder: number;
};

/** 포인트샵 노출용: 활성 상품(정렬순). */
export async function getActiveGifts(): Promise<GiftItem[]> {
  return prisma.giftItem.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { points: "asc" }],
  });
}

/** 단건 조회(교환 시 가격·활성 검증용). */
export async function getGiftItem(id: string): Promise<GiftItem | null> {
  return prisma.giftItem.findUnique({ where: { id } });
}
