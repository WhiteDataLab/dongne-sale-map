-- 회원 탈퇴 통계 로그(대시보드용). PII 없이 시각+가입경로만. 비파괴(additive).
CREATE TABLE "WithdrawalLog" (
    "id" TEXT NOT NULL,
    "provider" "Provider",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WithdrawalLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WithdrawalLog_createdAt_idx" ON "WithdrawalLog"("createdAt");
