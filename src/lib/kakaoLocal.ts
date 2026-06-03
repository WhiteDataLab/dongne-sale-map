// 카카오 로컬 REST 지오코딩 (서버 전용). REST 키는 클라이언트 노출 금지.
type Coord = { x?: string; y?: string };
type Doc = Coord & { address?: Coord; road_address?: Coord };

function pickCoord(doc: Doc): { lat: number; lng: number } | null {
  const x = doc.x || doc.address?.x || doc.road_address?.x;
  const y = doc.y || doc.address?.y || doc.road_address?.y;
  if (!x || !y) return null;
  const lat = Number(y);
  const lng = Number(x);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** 주소/장소명 → 좌표. 주소검색 우선 → 키워드검색 폴백. 키 없으면 null. */
export async function geocodeAddress(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  const REST_KEY = process.env.KAKAO_REST_API_KEY; // 런타임 시점에 읽음
  if (!REST_KEY || !query?.trim()) return null;
  for (const ep of ["keyword", "address"] as const) {
    try {
      const url = `https://dapi.kakao.com/v2/local/search/${ep}.json?query=${encodeURIComponent(
        query,
      )}&size=1`;
      const res = await fetch(url, {
        headers: { Authorization: `KakaoAK ${REST_KEY}` },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { documents?: Doc[] };
      const doc = data.documents?.[0];
      const coord = doc ? pickCoord(doc) : null;
      if (coord) return coord;
    } catch {
      // 네트워크 오류 → 다음 엔드포인트 시도
    }
  }
  return null;
}
