-- M5(수익화): 기프티콘 제휴 정산 — 상품 원가/액면가/제휴사 + 교환 스냅샷·정산. (멱등: 재실행 안전)

ALTER TABLE "GiftItem" ADD COLUMN IF NOT EXISTS "costKrw" INTEGER;
ALTER TABLE "GiftItem" ADD COLUMN IF NOT EXISTS "faceValueKrw" INTEGER;
ALTER TABLE "GiftItem" ADD COLUMN IF NOT EXISTS "partner" TEXT;

ALTER TABLE "Redemption" ADD COLUMN IF NOT EXISTS "costKrw" INTEGER;
ALTER TABLE "Redemption" ADD COLUMN IF NOT EXISTS "partner" TEXT;
ALTER TABLE "Redemption" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);
