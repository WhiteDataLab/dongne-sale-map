-- 고객센터 문의 첨부를 다중 이미지로 통일(다른 메뉴의 photoUrls 패턴과 동일).
-- 기존 단일 attachmentUrl 값은 배열로 이관 후 컬럼 제거.
ALTER TABLE "Inquiry" ADD COLUMN "attachmentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Inquiry" SET "attachmentUrls" = ARRAY["attachmentUrl"] WHERE "attachmentUrl" IS NOT NULL;
ALTER TABLE "Inquiry" DROP COLUMN "attachmentUrl";
