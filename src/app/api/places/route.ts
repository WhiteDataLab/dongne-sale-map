import { NextRequest, NextResponse } from "next/server";
import { ipLimit } from "@/lib/rateLimit";

/**
 * 카카오 로컬 키워드 장소검색 → 여러 후보 반환 (Phase: POI 연동 도입).
 * 검색 결과를 목록으로 보여주고, 선택 시 기존 가게 열기 또는 빠른 등록(prefill)에 사용.
 */
export const runtime = "nodejs";

type Doc = {
  place_name: string;
  address_name?: string;
  road_address_name?: string;
  x: string;
  y: string;
  phone?: string;
  category_group_name?: string;
};

export async function GET(req: NextRequest) {
  // 비인증 외부 API 프록시 — IP 폭주 방어(카카오 쿼터 고갈/비용 방지)
  const limited = ipLimit(req, "places", 30, 60_000);
  if (limited) return limited;

  const REST_KEY = process.env.KAKAO_REST_API_KEY;
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ places: [] });
  if (!REST_KEY) {
    return NextResponse.json({ error: "서버 키 미설정", places: [] }, { status: 503 });
  }
  try {
    let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=12`;
    // 현재 지도 중심(x=lng,y=lat)이 오면 근처 우선(거리순)
    const x = req.nextUrl.searchParams.get("x");
    const y = req.nextUrl.searchParams.get("y");
    if (x && y && Number.isFinite(Number(x)) && Number.isFinite(Number(y))) {
      url += `&x=${x}&y=${y}&radius=20000&sort=distance`;
    }
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${REST_KEY}` } });
    if (!res.ok) return NextResponse.json({ places: [] });
    const data = (await res.json()) as { documents?: Doc[] };
    const places = (data.documents ?? []).map((d) => ({
      name: d.place_name,
      address: d.address_name ?? "",
      roadAddress: d.road_address_name ?? "",
      lat: Number(d.y),
      lng: Number(d.x),
      phone: d.phone ?? "",
      category: d.category_group_name ?? "",
    }));
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] }, { status: 502 });
  }
}
