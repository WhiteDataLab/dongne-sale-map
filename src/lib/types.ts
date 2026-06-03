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
};

export type SaleDTO = {
  id: string;
  title: string;
  photoUrl: string;
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
};

/** 지오코딩 결과 (검색어 → 좌표). */
export type GeocodeResult = {
  lat: number;
  lng: number;
  name: string;
  address: string;
};
