import { prisma } from "@/lib/prisma";

// 포인트샵 기프티콘 카탈로그 — DB(GiftItem) 기반, 관리자 CRUD. 포인트 = 원.

/** 기프티콘 분류 프리셋(관리자 선택 + 상점 그룹 정렬 순서). 자유 입력도 허용. */
export const GIFT_CATEGORIES = [
  "커피·음료",
  "베이커리·디저트",
  "외식·식당",
  "편의점",
  "뷰티·드럭스토어",
  "기타",
] as const;

/** 빈 분류는 '기타'로 본다(상점 그룹핑·표시용). */
export function giftCategoryLabel(category: string | null | undefined): string {
  const c = category?.trim();
  return c ? c : "기타";
}

export type GiftItem = {
  id: string;
  brand: string;
  name: string;
  category: string | null;
  points: number;
  imageUrl: string | null;
  emoji: string;
  color: string;
  active: boolean;
  sortOrder: number;
};

/** 서버 전용: 정산 필드 포함(원가/제휴사). 소비자에게 노출 금지. */
export type GiftItemFull = GiftItem & {
  costKrw: number | null;
  faceValueKrw: number | null;
  partner: string | null;
};

// 소비자 노출 컬럼만 — costKrw/partner 등 정산 정보는 제외(서버 전용).
const CONSUMER_SELECT = {
  id: true,
  brand: true,
  name: true,
  category: true,
  points: true,
  imageUrl: true,
  emoji: true,
  color: true,
  active: true,
  sortOrder: true,
} as const;

/** 포인트샵 노출용: 활성 상품(정렬순). 정산 필드는 제외해 노출하지 않는다. */
export async function getActiveGifts(): Promise<GiftItem[]> {
  return prisma.giftItem.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { points: "asc" }],
    select: CONSUMER_SELECT,
  });
}

/** 단건 조회(교환 시 가격·활성 검증 + 원가/제휴사 스냅샷용). 서버 전용. */
export async function getGiftItem(id: string): Promise<GiftItemFull | null> {
  return prisma.giftItem.findUnique({ where: { id } });
}
