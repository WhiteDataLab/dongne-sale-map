-- Phase 7a: 사장님(merchant) 인증. 비파괴(additive).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'merchant';

CREATE TYPE "MerchantStatus" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "Store" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Store" ADD CONSTRAINT "Store_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");

CREATE TABLE "MerchantVerification" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "storeId"    TEXT NOT NULL,
  "docPath"    TEXT NOT NULL,
  "status"     "MerchantStatus" NOT NULL DEFAULT 'pending',
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "MerchantVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MerchantVerification_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MerchantVerification_status_idx" ON "MerchantVerification"("status");
CREATE INDEX "MerchantVerification_userId_idx" ON "MerchantVerification"("userId");
