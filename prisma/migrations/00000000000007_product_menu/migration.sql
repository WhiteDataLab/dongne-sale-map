-- Phase 7b: 메뉴(상품) 관리. 비파괴(additive).
ALTER TABLE "Product" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'product';
