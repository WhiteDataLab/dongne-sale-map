import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getMyCoupons } from "@/lib/coupons";

/** M3 — 내 쿠폰함(받은 쿠폰 목록). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });
  try {
    const coupons = await getMyCoupons(userId);
    return NextResponse.json({ coupons });
  } catch {
    return NextResponse.json({ error: "쿠폰을 불러오지 못했어요." }, { status: 500 });
  }
}
