-- M0(수익화): 전환 증명 + 트래픽 로깅.
-- StoreEvent(원본 이벤트) + StoreStatDaily(일·가게 집계 카운터). (멱등: 재실행 안전)

-- Enums
DO $$ BEGIN
  CREATE TYPE "EventType" AS ENUM ('impression','detail_open','directions_click','favorite','share','intent_visit');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "EventSource" AS ENUM ('pin','marquee','list','share','detail','other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- StoreEvent (원본)
CREATE TABLE IF NOT EXISTS "StoreEvent" (
  "id"        TEXT NOT NULL,
  "storeId"   TEXT NOT NULL,
  "userId"    TEXT,
  "sessionId" TEXT NOT NULL,
  "eventType" "EventType" NOT NULL,
  "source"    "EventSource" NOT NULL DEFAULT 'other',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StoreEvent_storeId_createdAt_idx" ON "StoreEvent"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "StoreEvent_storeId_eventType_createdAt_idx" ON "StoreEvent"("storeId", "eventType", "createdAt");

DO $$ BEGIN
  ALTER TABLE "StoreEvent" ADD CONSTRAINT "StoreEvent_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- StoreStatDaily (집계)
CREATE TABLE IF NOT EXISTS "StoreStatDaily" (
  "id"               TEXT NOT NULL,
  "storeId"          TEXT NOT NULL,
  "day"              TEXT NOT NULL,
  "impressions"      INTEGER NOT NULL DEFAULT 0,
  "detailOpens"      INTEGER NOT NULL DEFAULT 0,
  "directionsClicks" INTEGER NOT NULL DEFAULT 0,
  "favorites"        INTEGER NOT NULL DEFAULT 0,
  "shares"           INTEGER NOT NULL DEFAULT 0,
  "intentVisits"     INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StoreStatDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreStatDaily_storeId_day_key" ON "StoreStatDaily"("storeId", "day");
CREATE INDEX IF NOT EXISTS "StoreStatDaily_storeId_idx" ON "StoreStatDaily"("storeId");

DO $$ BEGIN
  ALTER TABLE "StoreStatDaily" ADD CONSTRAINT "StoreStatDaily_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
