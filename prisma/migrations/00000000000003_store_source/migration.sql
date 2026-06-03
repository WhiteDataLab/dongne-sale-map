-- Phase 6: 가게 등록 출처(소비자/사장님) 구분. 비파괴(additive).
CREATE TYPE "StoreSource" AS ENUM ('user', 'merchant');
ALTER TABLE "Store" ADD COLUMN "source" "StoreSource" NOT NULL DEFAULT 'user';
