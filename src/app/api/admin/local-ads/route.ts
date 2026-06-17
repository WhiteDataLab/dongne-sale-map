import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import { isPublicStorageUrl } from "@/lib/supabaseStorage";
import { LOCALAD_CATEGORIES } from "@/lib/localAds";

/** L4 — 지역 광고(로컬 광고주) 관리(관리자 전용·대행 등록). */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let b: {
    advertiser?: string;
    category?: string;
    title?: string;
    body?: string;
    region?: string;
    imageUrl?: string | null;
    linkUrl?: string | null;
    priceKrw?: number;
    days?: number;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const advertiser = b.advertiser?.trim();
  const title = b.title?.trim();
  const body = b.body?.trim();
  const region = b.region?.trim();
  if (!advertiser || !title || !body || !region) {
    return NextResponse.json({ error: "광고주·제목·내용·동네는 필수예요." }, { status: 400 });
  }
  const category = LOCALAD_CATEGORIES.includes((b.category ?? "") as (typeof LOCALAD_CATEGORIES)[number])
    ? (b.category as string)
    : "기타";
  if (b.imageUrl && !isPublicStorageUrl(b.imageUrl)) {
    return NextResponse.json({ error: "이미지 주소가 올바르지 않아요." }, { status: 400 });
  }
  // 외부 링크는 http/https 만 허용(스킴 인젝션 방어).
  let linkUrl: string | null = null;
  if (b.linkUrl?.trim()) {
    try {
      const u = new URL(b.linkUrl.trim());
      if (u.protocol === "http:" || u.protocol === "https:") linkUrl = u.toString();
    } catch {
      /* 무시 */
    }
  }
  const days = Number.isFinite(b.days) && (b.days as number) > 0 ? Math.min(365, b.days as number) : 30;
  const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const ad = await prisma.localAd.create({
    data: {
      advertiser,
      category,
      title: title.slice(0, 60),
      body: body.slice(0, 200),
      region: region.slice(0, 40),
      imageUrl: b.imageUrl || null,
      linkUrl,
      priceKrw: Number.isFinite(b.priceKrw) ? Math.max(0, Math.round(b.priceKrw as number)) : 0,
      endsAt,
      createdById: session.user.id,
    },
  });
  return NextResponse.json({ ok: true, id: ad.id });
}

export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: { id?: string; op?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!b.id) return NextResponse.json({ error: "id가 필요해요." }, { status: 400 });
  const op = b.op;
  const status = op === "pause" ? "paused" : op === "resume" ? "active" : op === "end" ? "ended" : null;
  if (!status) return NextResponse.json({ error: "알 수 없는 동작이에요." }, { status: 400 });
  try {
    await prisma.localAd.update({ where: { id: b.id }, data: { status } });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
