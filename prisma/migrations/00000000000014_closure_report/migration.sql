-- 소비자 휴업/폐업 제보 (사진 첨부). 비파괴(additive).
CREATE TYPE "ClosureKind" AS ENUM ('closed_today', 'shutdown');

CREATE TABLE "ClosureReport" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "ClosureKind" NOT NULL,
    "photoUrl" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClosureReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClosureReport_storeId_createdAt_idx" ON "ClosureReport"("storeId", "createdAt");

ALTER TABLE "ClosureReport" ADD CONSTRAINT "ClosureReport_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClosureReport" ADD CONSTRAINT "ClosureReport_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
