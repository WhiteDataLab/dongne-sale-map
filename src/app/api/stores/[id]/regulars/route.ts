import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageStore } from "@/lib/menu";
import { storeTier, tierAllowsLite } from "@/lib/pro";
import { getRegularSummary, type RegularSegment } from "@/lib/regulars";

/**
 * M10(수익화) — 단골 목록 조회(라이트+).
 * canManageStore + 라이트 이상. 닉네임·점수·세그먼트만(연락처 미노출). Pro 면 세그먼트 필터.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const store = await prisma.store
    .findUnique({ where: { id }, select: { id: true, ownerId: true, status: true } })
    .catch(() => null);
  if (!store || store.status !== "active") {
    return NextResponse.json({ error: "가게를 찾을 수 없어요." }, { status: 404 });
  }
  if (!canManageStore(store, user)) {
    return NextResponse.json({ error: "사장님·관리자만 볼 수 있어요." }, { status: 403 });
  }

  const tier = await storeTier(id);
  if (!tierAllowsLite(tier)) {
    return NextResponse.json(
      { error: "단골 관리는 라이트 플랜부터 사용할 수 있어요.", code: "tier_required", tier },
      { status: 402 },
    );
  }

  const segParam = req.nextUrl.searchParams.get("segment");
  const segment =
    tier === "pro" && (segParam === "active" || segParam === "at_risk" || segParam === "dormant")
      ? (segParam as RegularSegment)
      : "all";

  const { summary, rows } = await getRegularSummary(id);
  const filtered = segment === "all" ? rows : rows.filter((r) => r.segment === segment);

  return NextResponse.json({
    tier,
    canCampaign: tier === "pro", // 컴백 쿠폰 캠페인은 프로 전용
    summary,
    rows: filtered.slice(0, 200),
  });
}
