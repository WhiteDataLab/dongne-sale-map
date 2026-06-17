-- L4(수익화): 지역 광고 플랫폼 — LocalAd(로컬 광고주 동네 타게팅 정액 광고) + LocalAdStatus enum.

CREATE TYPE "LocalAdStatus" AS ENUM ('active', 'paused', 'ended');

CREATE TABLE "LocalAd" (
    "id" TEXT NOT NULL,
    "advertiser" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "region" TEXT NOT NULL,
    "status" "LocalAdStatus" NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "priceKrw" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalAd_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LocalAd_status_region_idx" ON "LocalAd"("status", "region");
