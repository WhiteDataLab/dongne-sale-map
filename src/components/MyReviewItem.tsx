"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewForm } from "./ReviewForm";
import { DeleteReviewButton } from "./DeleteReviewButton";
import { reviewDateLabel, starString } from "@/lib/format";
import type { ReviewDTO } from "@/lib/types";

type MyReview = {
  id: string;
  storeId: string;
  storeName: string;
  rating: number;
  content: string;
  photoUrls: string[];
  createdAt: string; // ISO
  likes: number;
  dislikes: number;
};

/** 마이페이지: 내 리뷰 1건 (표시 + 인라인 수정 + 삭제). */
export function MyReviewItem({ review }: { review: MyReview }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  // ReviewForm 수정 모드가 쓰는 필드만 채운 DTO (나머지는 표시에 불필요).
  const dto: ReviewDTO = {
    id: review.id,
    rating: review.rating,
    content: review.content,
    photoUrls: review.photoUrls,
    nickname: "",
    createdAt: review.createdAt,
    likeCount: review.likes,
    dislikeCount: review.dislikes,
    myReaction: null,
    isMine: true,
  };

  if (editing) {
    return (
      <li className="rounded-xl border border-gray-200 p-3">
        <p className="mb-2 truncate text-sm font-medium">🏪 {review.storeName}</p>
        <ReviewForm
          storeId={review.storeId}
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
    <li className="rounded-xl border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">🏪 {review.storeName}</p>
          <p className="text-amber-500 text-xs">{starString(review.rating)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            수정
          </button>
          <DeleteReviewButton reviewId={review.id} />
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{review.content}</p>
      {review.photoUrls.length > 0 && (
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto">
          {review.photoUrls.map((u, i) => (
            <div key={i} className="zoomable size-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-gray-400">
        {reviewDateLabel(review.createdAt)} · 👍 {review.likes} · 👎 {review.dislikes}
      </p>
    </li>
  );
}
