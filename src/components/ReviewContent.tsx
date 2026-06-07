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
}: {
  tags: string[];
  content: string;
  products: ReviewProduct[];
}) {
  return (
    <div className="mt-1 flex flex-col gap-1">
      {products.length > 0 && (
        <p className="text-xs text-gray-500">
          🛒 구매 메뉴: <span className="text-gray-700">{products.map((p) => p.name).join(", ")}</span>
        </p>
      )}
      {(tags.length > 0 || content.trim()) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs text-gray-600"
            >
              {t}
            </span>
          ))}
          {content.trim() && <span className="text-sm text-gray-700">{content}</span>}
        </div>
      )}
    </div>
  );
}
