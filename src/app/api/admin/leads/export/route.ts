import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { getLeads, LEAD_STATUS_LABEL } from "@/lib/leads";
import { kstDayString } from "@/lib/events";

/** M1-B: 영업 리드 CSV 내보내기 — 관리자 전용. 현재 필터(region/category) 반영. */
export const runtime = "nodejs";

function csvCell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const rows = await getLeads({
    region: sp.get("region") ?? undefined,
    category: sp.get("category") ?? undefined,
    limit: 1000,
  });

  const header = [
    "가게명", "카테고리", "주소", "연락처", "리드점수",
    "노출(30일)", "상세열람(30일)", "길찾기(30일)", "방문의향(30일)",
    "세일수", "리뷰수", "즐겨찾기", "등록자", "등록일", "아웃리치",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name, r.categoryLabel, r.address, r.phone ?? "", r.score,
        r.impressions30, r.detailOpens30, r.directionsClicks30, r.intentVisits30,
        r.sales, r.reviews, r.favorites, r.registeredBy,
        new Date(r.createdAt).toLocaleDateString("ko-KR"),
        LEAD_STATUS_LABEL[r.outreachStatus] ?? r.outreachStatus,
      ].map(csvCell).join(","),
    );
  }
  // BOM: Excel 한글 깨짐 방지
  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads_${kstDayString()}.csv"`,
    },
  });
}
