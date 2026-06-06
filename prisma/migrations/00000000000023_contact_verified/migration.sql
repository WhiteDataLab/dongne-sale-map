-- 연락처 SMS 인증 여부(추천 보상 조건). 비파괴(additive).
ALTER TABLE "User" ADD COLUMN "contactVerified" BOOLEAN NOT NULL DEFAULT false;
