-- 고객센터 1:1 문의. 비파괴(additive).
CREATE TYPE "InquiryStatus" AS ENUM ('open', 'answered');

CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "nickname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'open',
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Inquiry_userId_idx" ON "Inquiry"("userId");
CREATE INDEX "Inquiry_status_idx" ON "Inquiry"("status");

ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
