-- 리뷰 규칙 개편
--  * 구매 메뉴 연결(productIds, 최소 1개) + 다중 선택
--  * 태그(tags)를 본문(content)과 분리 저장 → 태그=원형 칩, content=일반 텍스트
--  * 같은 날 같은 가게 재작성은 포인트/별점 미반영(scored=false)
--  * 좋아요/싫어요(ReviewReaction) 기능 제거
-- (멱등: 부분 적용/재실행 안전)

ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "productIds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "scored" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Review" ALTER COLUMN "content" SET DEFAULT '';

CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review"("userId");

-- 좋아요/싫어요 제거
DROP TABLE IF EXISTS "ReviewReaction";
DROP TYPE IF EXISTS "ReactionKind";
