import { prisma } from "@/lib/prisma";
import { CATEGORY_META, type Category } from "@/lib/constants";
import { geocodeAddress } from "@/lib/kakaoLocal";
import { haversineMeters } from "@/lib/geo";
import { approveStore, rejectStore } from "../actions";

/** 주소 지오코딩 결과와 가게 좌표(핀) 대조 결과 라벨. */
function addressMatch(distance: number | null): { text: string; cls: string } {
  if (distance === null) return { text: "주소 확인 불가", cls: "bg-gray-100 text-gray-500" };
  if (distance <= 300)
    return { text: `주소 일치 ✓ (≈${Math.round(distance)}m)`, cls: "bg-green-100 text-green-700" };
  if (distance <= 1000)
    return { text: `주소 근접 (≈${Math.round(distance)}m)`, cls: "bg-amber-100 text-amber-700" };
  return {
    text: `주소 불일치? (≈${(distance / 1000).toFixed(1)}km)`,
    cls: "bg-red-100 text-red-700",
  };
}

/** 가게 인증 승인·반려 (스펙 Phase 4) + 제보자/주소대조 표시. */
export default async function AdminStores() {
  let stores: {
    id: string;
    name: string;
    category: string;
    address: string;
    lat: number;
    lng: number;
    createdAt: Date;
    createdBy: { nickname: string };
  }[] = [];
  try {
    stores = await prisma.store.findMany({
      where: { verified: false, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        category: true,
        address: true,
        lat: true,
        lng: true,
        createdAt: true,
        createdBy: { select: { nickname: true } },
      },
    });
  } catch {
    // DB 미연결
  }

  // 각 가게 주소를 지오코딩 → 핀 좌표와 거리 대조
  const distances = await Promise.all(
    stores.map(async (s) => {
      const geo = await geocodeAddress(s.address);
      return geo ? haversineMeters(s.lat, s.lng, geo.lat, geo.lng) : null;
    }),
  );

  if (stores.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">승인 대기 가게가 없어요.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {stores.map((s, i) => {
        const match = addressMatch(distances[i]);
        return (
          <li key={s.id} className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <span aria-hidden>{CATEGORY_META[s.category as Category].icon}</span>
              <span className="font-medium">{s.name}</span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{s.address}</p>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded px-1.5 py-0.5 font-medium ${match.cls}`}>
                {match.text}
              </span>
              <span className="text-gray-400">
                제보자: <b className="text-gray-600">{s.createdBy.nickname}</b>
              </span>
              <span className="text-gray-400">
                {new Date(s.createdAt).toLocaleDateString("ko-KR")}
              </span>
            </div>

            <div className="mt-2 flex gap-2">
              <form action={approveStore}>
                <input type="hidden" name="id" value={s.id} />
                <button className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 active:bg-green-800">
                  인증 승인
                </button>
              </form>
              <form action={rejectStore}>
                <input type="hidden" name="id" value={s.id} />
                <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200">
                  반려(숨김)
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
