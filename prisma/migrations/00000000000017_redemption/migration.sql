-- 기프티콘 교환(포인트샵) + 수령 연락처. 비파괴(additive).
ALTER TABLE "User" ADD COLUMN "contactPhone" TEXT;

CREATE TYPE "RedemptionStatus" AS ENUM ('requested', 'sent', 'canceled');

CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "contact" TEXT NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'requested',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Redemption_userId_idx" ON "Redemption"("userId");
CREATE INDEX "Redemption_status_idx" ON "Redemption"("status");

ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
