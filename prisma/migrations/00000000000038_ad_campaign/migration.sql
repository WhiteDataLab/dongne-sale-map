-- L3(수익화): 성과형 광고(CPA) — AdCampaign + AdCharge(세션·일 단위 1회 과금) + AdCampaignStatus enum.

CREATE TYPE "AdCampaignStatus" AS ENUM ('active', 'paused', 'depleted', 'canceled');

CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "bidKrw" INTEGER NOT NULL,
    "budgetKrw" INTEGER NOT NULL,
    "spentKrw" INTEGER NOT NULL DEFAULT 0,
    "chargedCount" INTEGER NOT NULL DEFAULT 0,
    "dailyCapKrw" INTEGER,
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdCampaign_storeId_status_idx" ON "AdCampaign"("storeId", "status");
CREATE INDEX "AdCampaign_status_idx" ON "AdCampaign"("status");

ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdCharge" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdCharge_campaignId_sessionId_day_key" ON "AdCharge"("campaignId", "sessionId", "day");
CREATE INDEX "AdCharge_campaignId_idx" ON "AdCharge"("campaignId");

ALTER TABLE "AdCharge" ADD CONSTRAINT "AdCharge_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
