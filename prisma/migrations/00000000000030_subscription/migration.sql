-- M2(수익화): 토스 빌링키 정기결제 구독 + 결제 로그. (멱등: 재실행 안전)

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing','active','past_due','canceled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('paid','failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"            TEXT NOT NULL,
  "storeId"       TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "customerKey"   TEXT NOT NULL,
  "billingKey"    TEXT,
  "status"        "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
  "priceKrw"      INTEGER NOT NULL DEFAULT 29800,
  "trialEndsAt"   TIMESTAMP(3) NOT NULL,
  "nextBillingAt" TIMESTAMP(3) NOT NULL,
  "lastPaymentAt" TIMESTAMP(3),
  "canceledAt"    TIMESTAMP(3),
  "failCount"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_customerKey_key" ON "Subscription"("customerKey");
CREATE INDEX IF NOT EXISTS "Subscription_status_nextBillingAt_idx" ON "Subscription"("status","nextBillingAt");
CREATE INDEX IF NOT EXISTS "Subscription_storeId_idx" ON "Subscription"("storeId");

CREATE TABLE IF NOT EXISTS "Payment" (
  "id"             TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "storeId"        TEXT NOT NULL,
  "orderId"        TEXT NOT NULL,
  "amount"         INTEGER NOT NULL,
  "status"         "PaymentStatus" NOT NULL,
  "tossPaymentKey" TEXT,
  "method"         TEXT,
  "failReason"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_orderId_key" ON "Payment"("orderId");
CREATE INDEX IF NOT EXISTS "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");
CREATE INDEX IF NOT EXISTS "Payment_storeId_idx" ON "Payment"("storeId");

-- Sponsorship ↔ Subscription 연결 컬럼
ALTER TABLE "Sponsorship" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;
CREATE INDEX IF NOT EXISTS "Sponsorship_subscriptionId_idx" ON "Sponsorship"("subscriptionId");

-- FK
DO $$ BEGIN
  ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
