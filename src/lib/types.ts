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
};

export type ReviewDTO = {
  id: string;
  rating: number;
  content: string;
  nickname: string;
  createdAt: string;
};

/** 가게 상세(바텀시트)용 DTO. (source 는 StoreDTO 에서 상속) */
export type StoreDetailDTO = StoreDTO & {
  phone: string | null;
  description: string | null;
  hours: StoreHours | null;
  isOpenNow: boolean | null;
  avgRating: number | null;
  reviewCount: number;
  products: ProductDTO[];
  sales: SaleDTO[];
  reviews: ReviewDTO[];
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
