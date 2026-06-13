import { NextRequest, NextResponse } from "next/server";
import { ipLimit } from "@/lib/rateLimit";

/**
 * 지오코딩: 검색어 → 좌표 (스펙: 위치정보 미수집, 검색 이동만).
 * 카카오 로컬 REST API 사용. REST 키는 서버 전용(클라이언트 노출 금지).
 * 키워드 검색 우선 → 실패 시 주소 검색 폴백.
 */
export const runtime = "nodejs";

const REST_KEY = process.env.KAKAO_REST_API_KEY;

type KakaoDoc = {
  x: string; // lng
  y: string; // lat
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
};

async function searchKakao(
  endpoint: "keyword" | "address",
  query: string,
): Promise<KakaoDoc | null> {
  const url = `https://dapi.kakao.com/v2/local/search/${endpoint}.json?query=${encodeURIComponent(
    query,
  )}&size=1`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${REST_KEY}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { documents?: KakaoDoc[] };
  return data.documents?.[0] ?? null;
}

export async function GET(req: NextRequest) {
  // 비인증 외부 API 프록시 — IP 폭주 방어(카카오 쿼터 고갈/비용 방지)
  const limited = await ipLimit(req, "geocode", 30, 60_000);
  if (limited) return limited;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "검색어를 입력해 주세요." }, { status: 400 });
  }
  if (!REST_KEY) {
    return NextResponse.json(
      { error: "서버에 카카오 REST 키가 설정되지 않았어요." },
      { status: 503 },
    );
  }

  try {
    const doc = (await searchKakao("keyword", q)) ?? (await searchKakao("address", q));
    if (!doc) {
      return NextResponse.json({ error: "검색 결과가 없어요." }, { status: 404 });
    }
    return NextResponse.json({
      lat: Number(doc.y),
      lng: Number(doc.x),
      name: doc.place_name ?? doc.address_name ?? q,
      address: doc.road_address_name || doc.address_name || "",
    });
  } catch {
    return NextResponse.json(
      { error: "검색 중 오류가 발생했어요." },
      { status: 502 },
    );
  }
}
