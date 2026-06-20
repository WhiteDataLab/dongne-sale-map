import type { ReviewProduct } from "@/lib/types";

/**
 * 리뷰 본문 표시: 구매 메뉴 + 태그(원형 칩) + 자유 텍스트.
 * - 태그로 빠르게 등록한 리뷰는 원형 테두리 칩으로 시각화한다.
 * - 태그 + 기타(직접 입력)를 섞으면 원형 칩 + 일반 텍스트 조합으로 보여준다.
 */
export function ReviewContent({
  tags,
  content,
  products,
  verified = false,
  receiptVerified = false,
}: {
  tags: string[];
  content: string;
  products: ReviewProduct[];
  verified?: boolean; // 사진이 함께 올라온 리뷰 = 사진 인증 배지
  receiptVerified?: boolean; // 영수증 인증(더 강한 신뢰 배지)
}) {
  return (
    <div className="mt-1 flex flex-col gap-1">
      {(products.length > 0 || verified || receiptVerified) && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
          {receiptVerified && (
            <span className="badge badge--verify !text-[11px]">🧾 영수증 인증</span>
          )}
          {verified && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
              📷 사진 인증
            </span>
          )}
          {products.length > 0 && (
            <span>
              🛒 구매 메뉴: <span className="text-ink-2">{products.map((p) => p.name).join(", ")}</span>
            </span>
          )}
        </p>
      )}
      {(tags.length > 0 || content.trim()) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink-2"
            >
              {t}
            </span>
          ))}
          {content.trim() && <span className="text-sm text-ink-2">{content}</span>}
        </div>
      )}
    </div>
  );
}
