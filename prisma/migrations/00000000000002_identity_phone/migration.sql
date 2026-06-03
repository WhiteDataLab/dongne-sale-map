-- Phase 5: 계정 연결용 Identity + 전화번호 본인확인. 비파괴(additive) + 기존 신원 backfill.

-- Provider enum 에 'phone' 추가
ALTER TYPE "Provider" ADD VALUE IF NOT EXISTS 'phone';

-- User: provider/providerId 를 선택값으로 완화하고 전화/실명 필드 추가
ALTER TABLE "User" ALTER COLUMN "provider" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "providerId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX IF EXISTS "User_provider_providerId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

-- Identity
CREATE TABLE IF NOT EXISTS "Identity" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "provider"   "Provider" NOT NULL,
  "providerId" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Identity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Identity_provider_providerId_key" ON "Identity"("provider", "providerId");
CREATE INDEX IF NOT EXISTS "Identity_userId_idx" ON "Identity"("userId");

-- PhoneVerification
CREATE TABLE IF NOT EXISTS "PhoneVerification" (
  "id"        TEXT NOT NULL,
  "phone"     TEXT NOT NULL,
  "codeHash"  TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "verified"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PhoneVerification_phone_idx" ON "PhoneVerification"("phone");

-- 기존 소셜 신원 → Identity 백필
INSERT INTO "Identity" ("id", "userId", "provider", "providerId")
SELECT gen_random_uuid()::text, "id", "provider", "providerId"
FROM "User"
WHERE "provider" IS NOT NULL AND "providerId" IS NOT NULL
ON CONFLICT ("provider", "providerId") DO NOTHING;
