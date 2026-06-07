import type { Category } from "@/lib/constants";
import type { StoreHours } from "@/lib/businessHours";

/** 가게 등록 출처: 소비자(주민) vs 사장님. */
export type StoreSource = "user" | "merchant";

/** 지도 핀 렌더링용 가게 DTO (API → 클라이언트). */
export type StoreDTO = {
  id: string;
  name: string;
  category: Category;
  lat: number;
  lng: number;
  address: string;
  verified: boolean;
  source: StoreSource;
  hasActiveSale: boolean;
  saleMinPrice: number | null; // 진행중 세일 최저가(지도 핀에 숫자로 표시) — 없으면 null
  saleSoonExpiring: boolean; // 1시간 내 마감되는 세일 존재(마감임박 강조)
  saleSoonestExpiry: string | null; // 가장 임박한 세일 만료(ISO) — 카운트다운/마감임박순 정렬
  saleLatestCreated: string | null; // 가장 최근 세일 등록(ISO) — 최신순 정렬
  isOpenNow: boolean | null; // 영업시간 기준 영업중 여부(정보 없으면 null)
  closedTodayReports: number; // 오늘 '갑자기 휴업' 제보 수
  shutdownReports: number; // 최근 '폐업' 제보 수
};

/** 지도 상단 광고판(마퀴)용 최신 세일. */
export type FeedSale = {
  id: string;
  storeId: string;
  title: string;
  salePrice: number;
  qty: string;
  storeName: string;
  createdAt: string;
};

/** 실시간 리뷰 스트림(유튜브 채팅 느낌)용. */
export type FeedReview = {
  id: string;
  nickname: string;
  content: string;
  rating: number;
  storeName: string;
};

/** 휴업/폐업 제보 DTO. */
export type ClosureReportDTO = {
  id: string;
  kind: "closed_today" | "shutdown";
  photoUrl: string | null;
  note: string | null;
  nickname: string;
  createdAt: string;
};

export type ProductDTO = {
  id: string;
  name: string;
  price: number;
  qtyUnit: string;
  stock: number | null;
  photoUrl: string | null;
  origin: string | null;
  createdAt: string;
  updatedAt: string;
  contributorNickname: string;
  contributorImg: string | null;
};

export type SaleDTO = {
  id: string;
  title: string;
  photoUrl: string;
  photoUrls: string[];
  salePrice: number;
  qty: string;
  expiresAt: string;
  createdAt: string;
  isMine: boolean; // 현재 사용자가 올린 제보인지 (삭제 버튼 노출)
};

/** 리뷰에 연결된 구매 메뉴(상품) 요약. */
export type ReviewProduct = { id: string; name: string };

export type ReviewDTO = {
  id: string;
  rating: number;
  content: string; // 자유 입력(기타) 본문 — 일반 텍스트로 표시
  tags: string[]; // 빠른 태그 — 원형 테두리 칩으로 표시
  products: ReviewProduct[]; // 구매한 메뉴(있던 것만 이름 해석)
  photoUrls: string[];
  receiptVerified: boolean; // 영수증 인증 여부(이미지 자체는 비공개 — 배지만)
  nickname: string;
  createdAt: string;
  scored: boolean; // 포인트·별점 반영 여부(같은 날 재작성=false)
  isMine: boolean;
};

/** 가게 상세(바텀시트)용 DTO. (source 는 StoreDTO 에서 상속) */
export type StoreDetailDTO = StoreDTO & {
  phone: string | null;
  description: string | null;
  notice: string | null; // 가게 공지사항 (사장님/관리자만 편집)
  hours: StoreHours | null;
  isOpenNow: boolean | null;
  avgRating: number | null;
  reviewCount: number;
  products: ProductDTO[];
  sales: SaleDTO[];
  reviews: ReviewDTO[];
  closureReports: ClosureReportDTO[]; // 최근 휴업/폐업 제보 (경고 배너용)
  isFavorite: boolean;
  hasOwner: boolean; // 사장님(소유자)이 인증된 가게인지
  isOwner: boolean; // 현재 사용자가 소유자인지
  canManageMenu: boolean; // 현재 사용자가 메뉴를 추가/수정/삭제할 수 있는지
  canManageStore: boolean; // 현재 사용자가 가게(배너 등)를 관리할 수 있는지 (소유자·관리자)
  bannerUrl: string | null; // 가게 상단 메인 사진
  registeredBy: { nickname: string; img: string | null }; // 최초 등록자
  owner: { nickname: string; img: string | null } | null; // 사장님(소유자)
};

/** 지오코딩 결과 (검색어 → 좌표). */
export type GeocodeResult = {
  lat: number;
  lng: number;
  name: string;
  address: string;
};
