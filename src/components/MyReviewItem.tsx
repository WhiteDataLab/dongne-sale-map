"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewForm } from "./ReviewForm";
import { DeleteReviewButton } from "./DeleteReviewButton";
import { ReviewContent } from "./ReviewContent";
import { ymd, starString } from "@/lib/format";
import type { ReviewDTO, ReviewProduct, ReviewReplyDTO } from "@/lib/types";

export type MyReview = {
  id: string;
  storeId: string;
  storeName: string;
  rating: number;
  content: string;
  tags: string[];
  products: ReviewProduct[];
  photoUrls: string[];
  receiptVerified: boolean;
  createdAt: string; // ISO
  scored: boolean;
  reply: ReviewReplyDTO | null; // M8: 사장님 답글(내 리뷰에 달린)
};

/** 마이페이지: 내 리뷰 1건 (표시 + 인라인 수정 + 삭제). */
export function MyReviewItem({ review }: { review: MyReview }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const dto: ReviewDTO = {
    id: review.id,
    rating: review.rating,
    content: review.content,
    tags: review.tags,
    products: review.products,
    photoUrls: review.photoUrls,
    receiptVerified: review.receiptVerified,
    nickname: "",
    createdAt: review.createdAt,
    scored: review.scored,
    isMine: true,
    reply: review.reply,
  };

  if (editing) {
    return (
      <li className="rounded-xl border border-line p-3">
        <p className="mb-2 truncate text-sm font-medium">🏪 {review.storeName}</p>
        <ReviewForm
          storeId={review.storeId}
          products={review.products}
          review={dto}
          onDone={() => {
            setEditing(false);
            router.refresh();
          }}
          onCancel={() => setEditing(false)}
          onToast={(m) => window.alert(m)}
        />
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">🏪 {review.storeName}</p>
          <p className="text-amber-500 text-xs">{starString(review.rating)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-wash"
          >
            수정
          </button>
          <DeleteReviewButton reviewId={review.id} />
        </div>
      </div>
      <ReviewContent
        tags={review.tags}
        content={review.content}
        products={review.products}
        verified={review.photoUrls.length > 0}
        receiptVerified={review.receiptVerified}
      />
      {review.photoUrls.length > 0 && (
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto">
          {review.photoUrls.map((u, i) => (
            <div key={i} className="zoomable size-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>
      )}
      {review.reply && (
        <div className="mt-2 rounded-lg border border-line-2 bg-surface-2 p-2">
          <p className="text-xs font-semibold text-indigo-700">🏪 사장님 답글</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-2">{review.reply.body}</p>
        </div>
      )}
      <p className="mt-1 text-xs text-ink-3">
        {ymd(review.createdAt)}
        {!review.scored && " · 별점·포인트 미반영"}
      </p>
    </li>
  );
}
