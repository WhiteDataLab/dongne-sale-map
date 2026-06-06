-- 출석체크: 마지막 출석일 + 연속 출석 일수. 비파괴(additive).
ALTER TABLE "User" ADD COLUMN "lastCheckInDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "checkInStreak" INTEGER NOT NULL DEFAULT 0;
