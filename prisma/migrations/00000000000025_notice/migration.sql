-- 플랫폼 공지/이벤트 (관리자 작성) — 공개 목록 + 알림함 소스
-- (멱등: 재실행 안전)

DO $$ BEGIN
  CREATE TYPE "NoticeKind" AS ENUM ('notice', 'event');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Notice" (
  "id"        TEXT NOT NULL,
  "kind"      "NoticeKind" NOT NULL DEFAULT 'notice',
  "title"     TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "pinned"    BOOLEAN NOT NULL DEFAULT false,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notice_active_pinned_createdAt_idx" ON "Notice"("active", "pinned", "createdAt");
