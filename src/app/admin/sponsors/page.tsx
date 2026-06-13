import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getSponsorships,
  SPONSOR_STATUS_LABEL,
  SPONSOR_PRICE_KRW,
  TRIAL_DAYS,
} from "@/lib/sponsors";
import { CATEGORY_META, type Category } from "@/lib/constants";
import {
  startSponsorTrial,
  confirmSponsorPayment,
  extendSponsor,
  cancelSponsor,
} from "../actions";

/**
 * M1-A(수익화) — 스폰서(정액 광고) 관리.
 * 상품: 묶음(마퀴 상단 고정 + 금색 핀) · 월 29,800원 · 14일 무료체험.
 * 결제(PG)는 M2 — 체험은 과금 없이 노출, 유료 전환은 입금 확인 후 '결제확인'으로 수동 처리.
 */
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  trial: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-400",
  canceled: "bg-gray-100 text-gray-400 line-through",
};

export default async function AdminSponsors({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  let sponsors: Awaited<ReturnType<typeof getSponsorships>> = [];
  let matches: { id: string; name: string; category: Category; address: string }[] = [];
  let dbError = false;
  try {
    sponsors = await getSponsorships();
    if (q) {
      const rows = await prisma.store.findMany({
        where: { status: "active", verified: true, name: { contains: q, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, name: true, category: true, address: true },
      });
      matches = rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category as Category,
        address: r.address,
      }));
    }
  } catch {
    dbError = true;
  }

  const liveCount = sponsors.filter((s) => s.live).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">스폰서 광고</h2>
        <p className="text-xs text-gray-400">
          묶음(마퀴 상단 고정 + 금색 핀) · 월 {SPONSOR_PRICE_KRW.toLocaleString("ko-KR")}원 · {TRIAL_DAYS}
          일 무료체험. 결제(PG)는 M2 — 입금 확인 후 ‘결제확인’을 눌러 유료로 전환하세요.
        </p>
      </div>

      {dbError && (
        <p className="py-10 text-center text-sm text-gray-400">데이터를 불러오지 못했어요 (DB 연결 확인).</p>
      )}

      {/* 새 스폰서 시작: 가게 검색 → 체험 시작 */}
      <section className="rounded-xl border border-gray-200 p-3">
        <h3 className="mb-2 text-sm font-semibold">＋ 새 스폰서 (무료체험 시작)</h3>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="인증된 가게명 검색"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black">
            검색
          </button>
        </form>

        {q && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {matches.length === 0 ? (
              <li className="py-3 text-center text-xs text-gray-400">
                ‘{q}’ 와 일치하는 <b>인증 가게</b>가 없어요. (스폰서는 인증 가게만 가능)
              </li>
            ) : (
              matches.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {CATEGORY_META[m.category].icon} {m.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">{m.address}</p>
                  </div>
                  <form action={startSponsorTrial} className="flex items-center gap-1.5">
                    <input type="hidden" name="storeId" value={m.id} />
                    <input
                      type="text"
                      name="region"
                      placeholder="동네 (예: 이문동)"
                      defaultValue="이문동"
                      className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    />
                    <button className="shrink-0 rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600">
                      🎁 {TRIAL_DAYS}일 체험 시작
                    </button>
                  </form>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      {/* 스폰서 목록 */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">스폰서 목록</h3>
          <span className="text-xs text-gray-400">
            노출 중 {liveCount} · 전체 {sponsors.length}
          </span>
        </div>

        {sponsors.length === 0 && !dbError ? (
          <p className="py-10 text-center text-sm text-gray-400">아직 스폰서가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sponsors.map((s) => (
              <li key={s.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">
                        {CATEGORY_META[s.category].icon} {s.storeName}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[s.status] ?? ""}`}>
                        {SPONSOR_STATUS_LABEL[s.status] ?? s.status}
                      </span>
                      {s.live && (
                        <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-black">
                          👑 노출중
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {s.region} · {s.address}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {s.priceKrw.toLocaleString("ko-KR")}원/월 · 노출종료{" "}
                      {new Date(s.endsAt).toLocaleDateString("ko-KR")} ·{" "}
                      {s.daysLeft >= 0 ? (
                        <span className={s.daysLeft <= 3 ? "font-semibold text-red-500" : ""}>
                          {s.daysLeft}일 남음
                        </span>
                      ) : (
                        <span className="text-gray-400">만료됨</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-50 pt-2">
                  {(s.status === "trial" || s.status === "active") && (
                    <>
                      <form action={confirmSponsorPayment}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">
                          ✓ 결제확인(+30일)
                        </button>
                      </form>
                      <form action={extendSponsor}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">
                          +30일 연장
                        </button>
                      </form>
                      <form action={cancelSponsor}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50">
                          취소
                        </button>
                      </form>
                    </>
                  )}
                  {(s.status === "expired" || s.status === "canceled") && (
                    <form action={extendSponsor}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">
                        재개(+30일)
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-gray-400">
        · 노출 보장은 ‘노출종료’ 시각까지예요. 만료되면 마퀴 고정·금색 핀이 자동 해제돼요(별도 작업 불필요).
        <br />· 결제 자동화(정기결제)는 M2(PG 연동) 단계예요. 지금은 입금 확인 후 ‘결제확인’으로 수동 연장하세요.
      </p>
    </div>
  );
}
