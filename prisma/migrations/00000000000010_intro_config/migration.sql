-- 외부 영상 링크 기능 제거(컬럼 드롭) + 사이트 설정(SiteConfig) 추가.
ALTER TABLE "Store" DROP COLUMN IF EXISTS "bannerVideoUrl";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "videoUrl";
ALTER TABLE "Sale" DROP COLUMN IF EXISTS "videoUrl";
ALTER TABLE "Review" DROP COLUMN IF EXISTS "videoUrl";

CREATE TABLE IF NOT EXISTS "SiteConfig" (
  "key"   TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("key")
);
