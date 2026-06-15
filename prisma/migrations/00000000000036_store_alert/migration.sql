-- M9(수익화): 가게 브로드캐스트 알림(세일/소식) — 라이트+ '관계' 기능.
-- 팬아웃 없음: 1행만 저장하고 알림함은 (StoreAlert ⋈ 내 Favorite) 조인으로 파생.

-- 알림 종류 enum
CREATE TYPE "StoreAlertKind" AS ENUM ('sale', 'notice');

-- 즐겨찾기 시점(알림함이 '팔로우 이후' 알림만 보여주기 위해 필요)
ALTER TABLE "Favorite" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 가게 브로드캐스트 알림
CREATE TABLE "StoreAlert" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "kind" "StoreAlertKind" NOT NULL DEFAULT 'sale',
    "saleId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreAlert_storeId_createdAt_idx" ON "StoreAlert"("storeId", "createdAt");

ALTER TABLE "StoreAlert" ADD CONSTRAINT "StoreAlert_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
