-- M1-B(수익화): 영업 리드 아웃리치 추적. (멱등: 재실행 안전)

DO $$ BEGIN
  CREATE TYPE "LeadStatus" AS ENUM ('new','contacted','proposed','converted','dropped');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "LeadOutreach" (
  "storeId"   TEXT NOT NULL,
  "status"    "LeadStatus" NOT NULL DEFAULT 'new',
  "note"      TEXT,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadOutreach_pkey" PRIMARY KEY ("storeId")
);

DO $$ BEGIN
  ALTER TABLE "LeadOutreach" ADD CONSTRAINT "LeadOutreach_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
