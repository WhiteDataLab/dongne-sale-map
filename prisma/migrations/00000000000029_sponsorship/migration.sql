-- M1-A(수익화): 스폰서 정액 광고(묶음 = 마퀴 고정 + 금색 핀). (멱등: 재실행 안전)

DO $$ BEGIN
  CREATE TYPE "SponsorStatus" AS ENUM ('trial','active','expired','canceled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Sponsorship" (
  "id"          TEXT NOT NULL,
  "storeId"     TEXT NOT NULL,
  "plan"        TEXT NOT NULL DEFAULT 'bundle',
  "region"      TEXT NOT NULL,
  "status"      "SponsorStatus" NOT NULL DEFAULT 'trial',
  "priceKrw"    INTEGER NOT NULL DEFAULT 29800,
  "trialEndsAt" TIMESTAMP(3) NOT NULL,
  "startsAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt"      TIMESTAMP(3) NOT NULL,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sponsorship_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Sponsorship_status_endsAt_idx" ON "Sponsorship"("status","endsAt");
CREATE INDEX IF NOT EXISTS "Sponsorship_storeId_idx" ON "Sponsorship"("storeId");

DO $$ BEGIN
  ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
