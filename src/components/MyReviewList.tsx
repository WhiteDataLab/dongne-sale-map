"use client";

import { useState } from "react";
import { MyReviewItem, type MyReview } from "./MyReviewItem";

const PREVIEW = 3;
const PAGE = 10;

/** 내가 쓴 리뷰 목록: 처음 3건 → 펼치면 10건씩 페이지네이션. */
export function MyReviewList({ reviews }: { reviews: MyReview[] }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  if (reviews.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
        아직 작성한 리뷰가 없어요.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(reviews.length / PAGE));
  const shown = expanded ? reviews.slice(page * PAGE, page * PAGE + PAGE) : reviews.slice(0, PREVIEW);

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {shown.map((r) => (
          <MyReviewItem key={r.id} review={r} />
        ))}
      </ul>

      {!expanded && reviews.length > PREVIEW && (
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setPage(0);
          }}
          className="mt-2 w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          펼쳐서 보기 (전체 {reviews.length}건)
        </button>
      )}

      {expanded && (
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              setPage(0);
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
          >
            접기
          </button>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-gray-300 px-2.5 py-1 font-medium text-gray-600 disabled:text-gray-300 hover:enabled:bg-gray-50"
              >
                이전
              </button>
              <span className="tabular-nums text-gray-500">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-gray-300 px-2.5 py-1 font-medium text-gray-600 disabled:text-gray-300 hover:enabled:bg-gray-50"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
