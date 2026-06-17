import { prisma } from "@/lib/prisma";
import { regionFromAddress } from "@/lib/sponsors";
import { CATEGORY_META, type Category } from "@/lib/constants";

/**
 * L6(수익화) — 동네 물가/세일 데이터 B2B.
 * Sale·Store(공개 콘텐츠)에서 **비식별 집계**만 산출한다(개별 가게/사용자 식별 없음).
 * 익명성 보장: 버킷에 가게가 MIN_STORES 미만이면 비공개(k-anonymity). 한계비용 0의 고마진 데이터 라인.
 */

/** k-익명성: 버킷에 이만큼의 서로 다른 가게가 있어야 공개. */
export const MIN_STORES = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

type SaleRow = {
  salePrice: number;
  createdAt: Date;
  productId: string | null;
  title: string;
  storeId: string;
  store: { category: string; address: string };
};

async function loadSales(periodDays: number): Promise<SaleRow[]> {
  const since = new Date(Date.now() - periodDays * DAY_MS);
  return prisma.sale.findMany({
    where: { createdAt: { gte: since } },
    select: {
      salePrice: true,
      createdAt: true,
      productId: true,
      title: true,
      storeId: true,
      store: { select: { category: true, address: true } },
    },
    take: 8000,
    orderBy: { createdAt: "asc" },
  });
}

/** 품목명 정규화(상품명/세일 제목 기반, 공백/숫자 단순화). */
function normalizeItem(title: string): string {
  return title.trim().replace(/\s+/g, " ").slice(0, 40);
}

export type RegionCategoryStat = {
  region: string;
  category: Category;
  categoryLabel: string;
  storeCount: number;
  saleCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
};

/** 동(region)×업종(category) 평균 세일가·건수(비식별, k-익명). */
export async function getRegionCategoryStats(periodDays = 90): Promise<RegionCategoryStat[]> {
  const sales = await loadSales(periodDays);
  const buckets = new Map<string, { region: string; category: string; prices: number[]; stores: Set<string> }>();
  for (const s of sales) {
    const region = regionFromAddress(s.store.address);
    if (region === "구독") continue;
    const key = `${region}|${s.store.category}`;
    let b = buckets.get(key);
    if (!b) {
      b = { region, category: s.store.category, prices: [], stores: new Set() };
      buckets.set(key, b);
    }
    b.prices.push(s.salePrice);
    b.stores.add(s.storeId);
  }
  const out: RegionCategoryStat[] = [];
  for (const b of buckets.values()) {
    if (b.stores.size < MIN_STORES) continue; // k-익명성
    const sum = b.prices.reduce((a, p) => a + p, 0);
    out.push({
      region: b.region,
      category: b.category as Category,
      categoryLabel: CATEGORY_META[b.category as Category]?.label ?? b.category,
      storeCount: b.stores.size,
      saleCount: b.prices.length,
      avgPrice: Math.round(sum / b.prices.length),
      minPrice: Math.min(...b.prices),
      maxPrice: Math.max(...b.prices),
    });
  }
  return out.sort((a, b) => a.region.localeCompare(b.region) || a.categoryLabel.localeCompare(b.categoryLabel));
}

export type ItemPriceStat = {
  item: string;
  storeCount: number;
  saleCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
};

/** 품목별 가격 분포(비식별, k-익명). 상위 N. */
export async function getItemPriceStats(periodDays = 90, limit = 30): Promise<ItemPriceStat[]> {
  const sales = await loadSales(periodDays);
  const itemNameByProduct = new Map<string, string>();
  const productIds = [...new Set(sales.map((s) => s.productId).filter((x): x is string => !!x))];
  if (productIds.length > 0) {
    const prods = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } });
    for (const p of prods) itemNameByProduct.set(p.id, p.name);
  }
  const buckets = new Map<string, { prices: number[]; stores: Set<string> }>();
  for (const s of sales) {
    const name = normalizeItem(s.productId ? (itemNameByProduct.get(s.productId) ?? s.title) : s.title);
    if (!name) continue;
    let b = buckets.get(name);
    if (!b) {
      b = { prices: [], stores: new Set() };
      buckets.set(name, b);
    }
    b.prices.push(s.salePrice);
    b.stores.add(s.storeId);
  }
  const out: ItemPriceStat[] = [];
  for (const [item, b] of buckets) {
    if (b.stores.size < MIN_STORES) continue;
    const sum = b.prices.reduce((a, p) => a + p, 0);
    out.push({
      item,
      storeCount: b.stores.size,
      saleCount: b.prices.length,
      avgPrice: Math.round(sum / b.prices.length),
      minPrice: Math.min(...b.prices),
      maxPrice: Math.max(...b.prices),
    });
  }
  return out.sort((a, b) => b.saleCount - a.saleCount).slice(0, limit);
}

export type MarketSummary = {
  periodDays: number;
  totalSales: number;
  activeStores: number;
  regionsCovered: number;
  publishedBuckets: number; // k-익명 통과 버킷 수
};

export async function getMarketSummary(periodDays = 90): Promise<MarketSummary> {
  const [sales, stats] = await Promise.all([loadSales(periodDays), getRegionCategoryStats(periodDays)]);
  const stores = new Set(sales.map((s) => s.storeId));
  const regions = new Set(sales.map((s) => regionFromAddress(s.store.address)).filter((r) => r !== "구독"));
  return {
    periodDays,
    totalSales: sales.length,
    activeStores: stores.size,
    regionsCovered: regions.size,
    publishedBuckets: stats.length,
  };
}
