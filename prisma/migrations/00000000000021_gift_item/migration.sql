-- 포인트샵 기프티콘 상품(관리자 CRUD). 비파괴(additive). 기본 카탈로그 시드 포함.
CREATE TABLE "GiftItem" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🎁',
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiftItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GiftItem_active_sortOrder_idx" ON "GiftItem"("active", "sortOrder");

INSERT INTO "GiftItem" ("id","brand","name","points","emoji","color","sortOrder") VALUES
  ('sb-americano','스타벅스','아메리카노 T',5000,'☕','#00704A',10),
  ('sb-latte','스타벅스','카페라떼 T',5500,'☕','#00704A',20),
  ('mega-americano','메가커피','아메리카노',2000,'🥤','#ffcc00',30),
  ('mega-latte','메가커피','카페라떼',2900,'🥤','#ffcc00',40),
  ('compose-americano','컴포즈커피','아메리카노',1500,'🥤','#1f1f1f',50),
  ('compose-latte','컴포즈커피','카페라떼',2500,'🥤','#1f1f1f',60);
