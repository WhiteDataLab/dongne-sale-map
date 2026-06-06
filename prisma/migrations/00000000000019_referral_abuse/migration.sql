-- 추천 보상 악용 방어: 지급 플래그 + 영구 연락처 원장. 비파괴(additive).
ALTER TABLE "User" ADD COLUMN "referralRewarded" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReferralClaim" (
    "id" TEXT NOT NULL,
    "contactHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralClaim_contactHash_key" ON "ReferralClaim"("contactHash");
