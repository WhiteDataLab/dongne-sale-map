-- migration 45: 동네 절약방 (THEME_MAP_BENCHMARK_PM_BRIEF §8-7, 거지맵 '거지방' 패턴)
-- 가벼운 커뮤니티 글(절약 꿀팁·득템 자랑) + 신고 자동숨김 연동(ReportTargetType 'post').
ALTER TYPE "ReportTargetType" ADD VALUE 'post';

CREATE TABLE "NeighborhoodPost" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeighborhoodPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NeighborhoodPost_hidden_createdAt_idx" ON "NeighborhoodPost"("hidden", "createdAt");
CREATE INDEX "NeighborhoodPost_region_createdAt_idx" ON "NeighborhoodPost"("region", "createdAt");

ALTER TABLE "NeighborhoodPost" ADD CONSTRAINT "NeighborhoodPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
