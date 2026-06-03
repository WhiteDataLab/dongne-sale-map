-- Phase 6: 카테고리 확장 (세탁/반찬/미용실/기타). 비파괴(enum 값 추가).
ALTER TYPE "StoreCategory" ADD VALUE IF NOT EXISTS 'laundry';
ALTER TYPE "StoreCategory" ADD VALUE IF NOT EXISTS 'sidedish';
ALTER TYPE "StoreCategory" ADD VALUE IF NOT EXISTS 'salon';
ALTER TYPE "StoreCategory" ADD VALUE IF NOT EXISTS 'etc';
