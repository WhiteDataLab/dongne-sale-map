-- 신고 누적 자동 숨김(soft hide)용 컬럼 추가 (Phase 4). 비파괴(additive).
ALTER TABLE "Review" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
