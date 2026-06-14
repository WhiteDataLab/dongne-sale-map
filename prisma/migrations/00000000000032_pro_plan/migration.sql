-- M4(수익화): 프로 플랜 — 구독에 plan 구분자, 가게에 사진 갤러리. (멱등: 재실행 안전)

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'sponsor';
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "galleryUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
