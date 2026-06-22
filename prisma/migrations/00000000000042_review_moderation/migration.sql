-- 리뷰 자동 모더레이션: 욕설·음란·광고 감지 시 '임시 보관함'(held)으로 격리.
-- 삭제가 아니라 비공개 보류 → 오인 격리 시 작성자가 억울하지 않게 관리자가 복원 가능.
ALTER TABLE "Review" ADD COLUMN "held" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Review" ADD COLUMN "heldReason" TEXT;
ALTER TABLE "Review" ADD COLUMN "heldAt" TIMESTAMP(3);
CREATE INDEX "Review_held_idx" ON "Review"("held");
