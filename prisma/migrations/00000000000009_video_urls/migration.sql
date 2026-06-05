-- 동영상 링크(YouTube 등 외부 임베드). 비파괴(additive).
ALTER TABLE "Store" ADD COLUMN "bannerVideoUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "videoUrl" TEXT;
ALTER TABLE "Sale" ADD COLUMN "videoUrl" TEXT;
ALTER TABLE "Review" ADD COLUMN "videoUrl" TEXT;
