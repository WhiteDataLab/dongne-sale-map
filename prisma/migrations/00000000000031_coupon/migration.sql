-- M3(수익화): 사장님 쿠폰(발행) + 소비자 쿠폰 보유(받기/사용). (멱등: 재실행 안전)

DO $$ BEGIN
  CREATE TYPE "CouponStatus" AS ENUM ('active','expired','hidden');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CouponClaimStatus" AS ENUM ('claimed','used');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Coupon" (
  "id"          TEXT NOT NULL,
  "storeId"     TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "condition"   TEXT,
  "totalLimit"  INTEGER,
  "status"      "CouponStatus" NOT NULL DEFAULT 'active',
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Coupon_storeId_idx" ON "Coupon"("storeId");
CREATE INDEX IF NOT EXISTS "Coupon_status_expiresAt_idx" ON "Coupon"("status","expiresAt");

CREATE TABLE IF NOT EXISTS "CouponClaim" (
  "id"        TEXT NOT NULL,
  "couponId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "status"    "CouponClaimStatus" NOT NULL DEFAULT 'claimed',
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt"    TIMESTAMP(3),
  CONSTRAINT "CouponClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CouponClaim_couponId_userId_key" ON "CouponClaim"("couponId","userId");
CREATE INDEX IF NOT EXISTS "CouponClaim_userId_idx" ON "CouponClaim"("userId");

-- FK
DO $$ BEGIN
  ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CouponClaim" ADD CONSTRAINT "CouponClaim_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CouponClaim" ADD CONSTRAINT "CouponClaim_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
