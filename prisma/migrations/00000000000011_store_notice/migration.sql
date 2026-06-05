-- 가게 공지사항(notice). 사장님/관리자만 작성·수정·삭제, 소비자는 조회만. 비파괴(additive).
ALTER TABLE "Store" ADD COLUMN "notice" TEXT;
