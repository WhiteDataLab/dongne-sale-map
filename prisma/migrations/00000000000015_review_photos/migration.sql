-- 리뷰 사진(선택). 2번째 리뷰부터는 사진 있어야 포인트 지급. 비파괴(additive).
ALTER TABLE "Review" ADD COLUMN "photoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
