-- 리뷰 영수증 인증(선택). 영수증 이미지는 비공개 버킷 경로만 저장(공개 노출 X).
-- (멱등: 재실행 안전)
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
