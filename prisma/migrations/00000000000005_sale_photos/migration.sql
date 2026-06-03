-- Phase 6: 세일 사진 다중(최대 10장). 비파괴(additive). 기존 행은 빈 배열.
ALTER TABLE "Sale" ADD COLUMN "photoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
