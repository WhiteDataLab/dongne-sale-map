-- 계정 식별자(ID값): 소셜=이메일/생성값, 전화=전화번호. 비파괴(additive).
ALTER TABLE "User" ADD COLUMN "accountId" TEXT;

CREATE INDEX "User_accountId_idx" ON "User"("accountId");
