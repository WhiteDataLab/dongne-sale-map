import { PrismaClient } from "@prisma/client";

/**
 * 개발용 시드: 이문동 주변 샘플 가게/상품/세일/리뷰 + 영업시간.
 * Phase 1 핀 + Phase 2 상세(상품/세일/공지/리뷰/영업판정) 확인용 더미 데이터.
 * 실행: npm run db:seed (DB 연결 필요).
 *
 * 멱등성: 우리 모델만 비우고 다시 만든다. (기존 다른 앱 테이블은 건드리지 않음)
 */
const prisma = new PrismaClient();

// 영업시간 프리셋 (요일 키별 {open, close} 또는 null=휴무)
const H_DAILY = (open: string, close: string) =>
  Object.fromEntries(
    ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { open, close }]),
  );

const STORES = [
  {
    name: "이문 청과",
    category: "vegetable", // 야채/과일 혼합 가게지만 카테고리는 단일
    lat: 37.5982,
    lng: 127.0601,
    verified: true,
    phone: "02-960-1234",
    description: "이문동 골목 입구 과일·채소 가게입니다. 매일 새벽 시장에서 떼옵니다.",
    hours: H_DAILY("08:00", "21:00"),
    products: [
      { name: "사과 (부사)", price: 9900, qtyUnit: "5개", origin: "경북 청송", stock: 12 },
      { name: "대파", price: 2500, qtyUnit: "1단", origin: "국산", stock: null },
    ],
    sales: [{ title: "딸기 1박스 떨이", salePrice: 6900, qty: "1박스(500g)" }],
    reviews: [
      { rating: 5, content: "과일이 신선하고 사장님이 친절해요." },
      { rating: 4, content: "가격도 적당하고 좋아요." },
    ],
  },
  {
    name: "행복 정육점",
    category: "meat",
    lat: 37.5968,
    lng: 127.0585,
    verified: true,
    phone: "02-961-5678",
    description: "한우·한돈 전문. 주문 즉시 손질해 드립니다.",
    hours: { ...H_DAILY("09:00", "20:00"), sun: null }, // 일요일 휴무
    products: [
      { name: "삼겹살", price: 19800, qtyUnit: "600g", origin: "국내산", stock: null },
      { name: "한우 등심", price: 39000, qtyUnit: "300g", origin: "1++ 등급", stock: 5 },
    ],
    sales: [{ title: "삼겹살 100g 특가", salePrice: 1980, qty: "100g" }],
    reviews: [{ rating: 5, content: "고기 질이 좋아요. 단골입니다." }],
  },
  {
    name: "신선 야채가게",
    category: "vegetable",
    lat: 37.5991,
    lng: 127.0578,
    verified: true,
    phone: null,
    description: "잎채소·뿌리채소 종류가 다양합니다.",
    hours: H_DAILY("06:00", "22:00"),
    products: [{ name: "상추", price: 2000, qtyUnit: "1봉", origin: "국산", stock: null }],
    sales: [],
    reviews: [],
  },
  {
    name: "이문시장 과일",
    category: "fruit",
    lat: 37.5959,
    lng: 127.0612,
    verified: false, // 미인증 → 회색 핀
    phone: null,
    description: "",
    hours: H_DAILY("09:00", "19:00"),
    products: [],
    sales: [],
    reviews: [],
  },
  {
    name: "동대문 채소",
    category: "vegetable",
    lat: 37.5973,
    lng: 127.0629,
    verified: true,
    phone: "02-962-0000",
    description: "24시간 운영하는 채소 가게입니다.",
    hours: H_DAILY("00:00", "23:59"), // 사실상 24시간
    products: [{ name: "애호박", price: 1000, qtyUnit: "2개", origin: "국산", stock: 30 }],
    sales: [{ title: "애호박 2개 1000원", salePrice: 1000, qty: "2개" }],
    reviews: [{ rating: 3, content: "늦은 밤에도 열려서 편해요." }],
  },
  {
    name: "골목 정육",
    category: "meat",
    lat: 37.5996,
    lng: 127.0567,
    verified: false, // 미인증
    phone: null,
    description: "",
    hours: H_DAILY("10:00", "21:00"),
    products: [],
    sales: [],
    reviews: [],
  },
] as const;

async function main() {
  // 우리 모델만 초기화 (의존 역순)
  await prisma.phoneVerification.deleteMany();
  await prisma.pointLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.review.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany({ where: { providerId: { startsWith: "seed-" } } });

  const seeder = await prisma.user.create({
    data: {
      provider: "kakao",
      providerId: "seed-system",
      nickname: "동네지기",
      identities: { create: { provider: "kakao", providerId: "seed-system" } },
    },
  });
  const reviewer = await prisma.user.create({
    data: {
      provider: "naver",
      providerId: "seed-reviewer",
      nickname: "이문주민",
      identities: { create: { provider: "naver", providerId: "seed-reviewer" } },
    },
  });
  // 데모용 사장님(merchant) — '행복 정육점' 소유자. source=merchant 는 항상 소유자와 함께여야 정합.
  const merchant = await prisma.user.create({
    data: {
      provider: "kakao",
      providerId: "seed-merchant",
      nickname: "행복정육사장",
      role: "merchant",
      identities: { create: { provider: "kakao", providerId: "seed-merchant" } },
    },
  });

  for (const s of STORES) {
    const store = await prisma.store.create({
      data: {
        name: s.name,
        category: s.category,
        address: "서울 동대문구 이문동",
        lat: s.lat,
        lng: s.lng,
        verified: s.verified,
        // 데모: '행복 정육점'은 사장님 가게 — source=merchant + 소유자(ownerId) 함께 지정(정합)
        source: s.name === "행복 정육점" ? "merchant" : "user",
        ownerId: s.name === "행복 정육점" ? merchant.id : null,
        phone: s.phone,
        description: s.description,
        hoursJson: s.hours,
        createdById: seeder.id,
      },
    });

    for (const p of s.products) {
      await prisma.product.create({
        data: {
          storeId: store.id,
          name: p.name,
          price: p.price,
          qtyUnit: p.qtyUnit,
          stock: p.stock,
          origin: p.origin,
          createdById: seeder.id,
        },
      });
    }

    for (const sale of s.sales) {
      await prisma.sale.create({
        data: {
          storeId: store.id,
          title: sale.title,
          photoUrl: "https://placehold.co/600x400?text=Sale",
          salePrice: sale.salePrice,
          qty: sale.qty,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2시간 뒤 만료
          createdById: seeder.id,
        },
      });
    }

    for (const rv of s.reviews) {
      await prisma.review.create({
        data: {
          storeId: store.id,
          userId: reviewer.id,
          rating: rv.rating,
          content: rv.content,
        },
      });
    }
  }

  console.log(`✅ 시드 완료: 가게 ${STORES.length}곳 (상품/세일/리뷰/영업시간 포함)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
