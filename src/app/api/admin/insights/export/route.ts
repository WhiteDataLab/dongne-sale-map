import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { getRegionCategoryStats, getItemPriceStats } from "@/lib/insights";
import { kstDayString } from "@/lib/events";

/** L6 — 동네 물가 데이터 CSV 내보내기(관리자). type=region|item, days=30|90|180. 비식별 집계. */
export const runtime = "nodejs";

function csvCell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const days = sp.get("days") === "30" ? 30 : sp.get("days") === "180" ? 180 : 90;
  const type = sp.get("type") === "item" ? "item" : "region";

  let header: string[];
  let lines: string[];
  if (type === "item") {
    const rows = await getItemPriceStats(days, 200);
    header = ["품목", "가게수", "세일수", "평균가", "최저가", "최고가"];
    lines = [header.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push([r.item, r.storeCount, r.saleCount, r.avgPrice, r.minPrice, r.maxPrice].map(csvCell).join(","));
    }
  } else {
    const rows = await getRegionCategoryStats(days);
    header = ["동네", "업종", "가게수", "세일수", "평균가", "최저가", "최고가"];
    lines = [header.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push(
        [r.region, r.categoryLabel, r.storeCount, r.saleCount, r.avgPrice, r.minPrice, r.maxPrice]
          .map(csvCell)
          .join(","),
      );
    }
  }
  const csv = "﻿" + lines.join("\r\n"); // BOM: Excel 한글

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="insights_${type}_${days}d_${kstDayString()}.csv"`,
    },
  });
}
