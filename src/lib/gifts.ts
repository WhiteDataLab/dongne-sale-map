// 기프티콘 카탈로그 (포인트샵). 포인트 = 원 (5000P = 5000원 상당).
// 실제 발송은 관리자가 외부 기프티콘 전문샵에서 구매해 등록 연락처로 보냄(수동 운영).

export type GiftItem = {
  id: string;
  brand: string;
  name: string;
  points: number; // 필요 포인트(=원)
  emoji: string;
  color: string; // 브랜드 색
};

export const GIFT_CATALOG: GiftItem[] = [
  { id: "sb-americano", brand: "스타벅스", name: "아메리카노 T", points: 5000, emoji: "☕", color: "#00704A" },
  { id: "sb-latte", brand: "스타벅스", name: "카페라떼 T", points: 5500, emoji: "☕", color: "#00704A" },
  { id: "mega-americano", brand: "메가커피", name: "아메리카노", points: 2000, emoji: "🥤", color: "#ffcc00" },
  { id: "mega-latte", brand: "메가커피", name: "카페라떼", points: 2900, emoji: "🥤", color: "#ffcc00" },
  { id: "compose-americano", brand: "컴포즈커피", name: "아메리카노", points: 1500, emoji: "🥤", color: "#1f1f1f" },
  { id: "compose-latte", brand: "컴포즈커피", name: "카페라떼", points: 2500, emoji: "🥤", color: "#1f1f1f" },
];

export function findGiftItem(id: string): GiftItem | null {
  return GIFT_CATALOG.find((g) => g.id === id) ?? null;
}
