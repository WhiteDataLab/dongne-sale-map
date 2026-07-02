-- migration 44: 콜드스타트 원탭 세일 제보 (THEME_MAP_BENCHMARK_PM_BRIEF P0-1)
-- 사진·가격 없이도 '여기 세일중' 한 방 제보가 가능하도록 선택값으로 완화.
-- 기존 데이터는 그대로(NOT NULL 해제만) — 롤백 시에도 데이터 손실 없음.
ALTER TABLE "Sale" ALTER COLUMN "photoUrl" DROP NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "salePrice" DROP NOT NULL;
