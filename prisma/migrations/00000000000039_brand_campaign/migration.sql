-- L5(수익화): 브랜드 스폰서 리워드 — BrandCampaign + BrandRedemption + BrandCampaignStatus enum.

CREATE TYPE "BrandCampaignStatus" AS ENUM ('active', 'paused', 'ended');

CREATE TABLE "BrandCampaign" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "giftItemId" TEXT NOT NULL,
    "cpaKrw" INTEGER NOT NULL,
    "budgetKrw" INTEGER NOT NULL,
    "spentKrw" INTEGER NOT NULL DEFAULT 0,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "status" "BrandCampaignStatus" NOT NULL DEFAULT 'active',
    "note" TEXT,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrandCampaign_giftItemId_status_idx" ON "BrandCampaign"("giftItemId", "status");
CREATE INDEX "BrandCampaign_status_idx" ON "BrandCampaign"("status");

ALTER TABLE "BrandCampaign" ADD CONSTRAINT "BrandCampaign_giftItemId_fkey" FOREIGN KEY ("giftItemId") REFERENCES "GiftItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BrandRedemption" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrandRedemption_redemptionId_key" ON "BrandRedemption"("redemptionId");
CREATE INDEX "BrandRedemption_campaignId_idx" ON "BrandRedemption"("campaignId");
CREATE INDEX "BrandRedemption_userId_idx" ON "BrandRedemption"("userId");

ALTER TABLE "BrandRedemption" ADD CONSTRAINT "BrandRedemption_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BrandCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
