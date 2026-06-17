import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * L5(수익화) — 브랜드 스폰서 리워드.
 * 브랜드가 특정 기프티콘(리워드)을 후원하고, 소비자가 그 기프티콘을 상환(redeem)할 때마다 CPA 를 낸다.
 * → 기프티콘 원가(변동비)를 브랜드 광고 매출로 전환. 어뷰징은 1인 한도 + redemptionId 1:1 로 방어.
 */

export const BRAND_MIN_CPA = 100;
export const BRAND_MAX_CPA = 5000;
export const BRAND_MIN_BUDGET = 10_000;

/** 후원 가능한(예산 남은) 활성 캠페인 1건. */
async function findLiveCampaign(giftItemId: string, now: Date) {
  const rows = await prisma.brandCampaign.findMany({
    where: {
      giftItemId,
      status: "active",
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.find((c) => c.spentKrw < c.budgetKrw) ?? null;
}

/**
 * 기프티콘 상환에 대한 브랜드 CPA 적립(best-effort, 교환 트랜잭션 밖에서 호출).
 * - 활성·예산남은 캠페인이 있고, 1인 한도 미만이면 적립.
 * - redemptionId 1:1 유니크로 한 교환은 1회만 인정.
 * 실패해도 교환은 이미 성공이므로 조용히 무시한다.
 */
export async function accrueBrandReward(opts: {
  giftItemId: string;
  redemptionId: string;
  userId: string;
  now?: Date;
}): Promise<void> {
  const now = opts.now ?? new Date();
  const campaign = await findLiveCampaign(opts.giftItemId, now);
  if (!campaign) return;

  // 1인 한도 체크.
  const mine = await prisma.brandRedemption.count({
    where: { campaignId: campaign.id, userId: opts.userId },
  });
  if (mine >= campaign.perUserLimit) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.brandRedemption.create({
        data: {
          campaignId: campaign.id,
          redemptionId: opts.redemptionId, // 1:1 유니크
          userId: opts.userId,
          amountKrw: campaign.cpaKrw,
        },
      });
      const updated = await tx.brandCampaign.update({
        where: { id: campaign.id },
        data: { spentKrw: { increment: campaign.cpaKrw }, redeemedCount: { increment: 1 } },
        select: { spentKrw: true, budgetKrw: true },
      });
      if (updated.spentKrw >= updated.budgetKrw) {
        await tx.brandCampaign.update({ where: { id: campaign.id }, data: { status: "ended" } });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return; // 중복 인정 방지(정상)
    // 그 외는 무시(교환은 이미 성공)
  }
}

/** /shop 배지용: 주어진 기프티콘 중 현재 후원 중인 것 → 브랜드명 맵. */
export async function getSponsoredBrandMap(giftIds: string[], now: Date = new Date()): Promise<Map<string, string>> {
  if (giftIds.length === 0) return new Map();
  const rows = await prisma.brandCampaign.findMany({
    where: { giftItemId: { in: giftIds }, status: "active", OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { giftItemId: true, brand: true, spentKrw: true, budgetKrw: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) if (r.spentKrw < r.budgetKrw) map.set(r.giftItemId, r.brand);
  return map;
}

/** 관리자 리포트용 캠페인 목록(+기프티콘명·원가). */
export type BrandCampaignRow = {
  id: string;
  brand: string;
  giftName: string;
  giftCostKrw: number | null;
  cpaKrw: number;
  budgetKrw: number;
  spentKrw: number;
  redeemedCount: number;
  perUserLimit: number;
  status: "active" | "paused" | "ended";
  endsAt: string | null;
  createdAt: string;
};

export async function getBrandCampaigns(): Promise<BrandCampaignRow[]> {
  const rows = await prisma.brandCampaign.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
    include: { giftItem: { select: { brand: true, name: true, costKrw: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    brand: c.brand,
    giftName: `${c.giftItem.brand} ${c.giftItem.name}`,
    giftCostKrw: c.giftItem.costKrw,
    cpaKrw: c.cpaKrw,
    budgetKrw: c.budgetKrw,
    spentKrw: c.spentKrw,
    redeemedCount: c.redeemedCount,
    perUserLimit: c.perUserLimit,
    status: c.status as BrandCampaignRow["status"],
    endsAt: c.endsAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));
}
