import { prisma } from "@/lib/prisma";
import { settleRedemption, unsettleRedemption } from "../actions";

/**
 * M5(수익화) — 기프티콘 제휴 정산 리포트.
 * 교환(Redemption)의 원가(costKrw)·제휴사(partner) 스냅샷으로 실지출·마진을 집계한다.
 * 발송은 /admin/redemptions(수동) 유지. 여기선 제휴사 정산(원가 확정/완료)만 관리.
 * 마진 = 포인트 사용(=소비자 액면) − 원가(실지출).  ※실 제휴사 API 자동정산은 계약 후(TODO).
 */
export const dynamic = "force-dynamic";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

type Row = {
  id: string;
  itemName: string;
  points: number;
  costKrw: number | null;
  partner: string | null;
  status: string;
  settledAt: Date | null;
  createdAt: Date;
  user: { nickname: string };
};

export default async function AdminSettlements() {
  let rows: Row[] = [];
  let dbError = false;
  try {
    rows = await prisma.redemption.findMany({
      where: { status: { in: ["requested", "sent"] } },
      orderBy: [{ settledAt: "asc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        id: true,
        itemName: true,
        points: true,
        costKrw: true,
        partner: true,
        status: true,
        settledAt: true,
        createdAt: true,
        user: { select: { nickname: true } },
      },
    });
  } catch {
    dbError = true;
  }

  if (dbError) {
    return <p className="py-10 text-center text-sm text-ink-3">정산 정보를 불러오지 못했어요.</p>;
  }

  const sumPoints = rows.reduce((a, r) => a + r.points, 0);
  const sumCost = rows.reduce((a, r) => a + (r.costKrw ?? 0), 0);
  const margin = sumPoints - sumCost;
  const settledCost = rows.filter((r) => r.settledAt).reduce((a, r) => a + (r.costKrw ?? 0), 0);
  const unsettledCost = sumCost - settledCost;
  const noCost = rows.filter((r) => r.costKrw == null && r.status === "sent").length;

  // 제휴사별 집계
  const byPartner = new Map<string, { count: number; points: number; cost: number; unsettled: number }>();
  for (const r of rows) {
    const key = r.partner?.trim() || "(미지정)";
    const g = byPartner.get(key) ?? { count: 0, points: 0, cost: 0, unsettled: 0 };
    g.count += 1;
    g.points += r.points;
    g.cost += r.costKrw ?? 0;
    if (!r.settledAt) g.unsettled += r.costKrw ?? 0;
    byPartner.set(key, g);
  }
  const partners = [...byPartner.entries()].sort((a, b) => b[1].cost - a[1].cost);

  // 발송 완료(sent) 건 = 실제 정산 대상
  const settleList = rows.filter((r) => r.status === "sent");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">제휴 정산</h2>
        <p className="text-xs text-ink-3">
          교환 시점의 <b>원가·제휴사</b> 스냅샷으로 실지출/마진을 집계해요. 발송은 ‘기프티콘 교환’에서, 여기선 정산(원가 확정)만.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-line p-3">
          <p className="text-[11px] text-ink-3">교환 건수</p>
          <p className="text-lg font-bold">{rows.length.toLocaleString("ko-KR")}건</p>
        </div>
        <div className="rounded-xl border border-line p-3">
          <p className="text-[11px] text-ink-3">포인트 사용(명목 액면)</p>
          <p className="text-lg font-bold">{won(sumPoints)}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <p className="text-[11px] text-rose-500">원가 합계(실지출)</p>
          <p className="text-lg font-bold text-rose-600">{won(sumCost)}</p>
          <p className="mt-0.5 text-[10px] text-ink-3">미정산 {won(unsettledCost)} · 정산완료 {won(settledCost)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-[11px] text-emerald-600">마진(액면−원가)</p>
          <p className="text-lg font-bold text-emerald-700">{won(margin)}</p>
          {noCost > 0 && <p className="mt-0.5 text-[10px] text-ink-3">원가 미입력 {noCost}건 제외</p>}
        </div>
      </div>

      {/* 제휴사별 */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">제휴사별</h3>
        {partners.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-3">집계할 교환이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {partners.map(([name, g]) => (
              <li key={name} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="font-medium">{name}</span>
                <span className="text-xs text-ink-3">
                  {g.count}건 · 원가 {won(g.cost)}
                  {g.unsettled > 0 && <span className="ml-1 text-rose-500">· 미정산 {won(g.unsettled)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 정산 대상(발송 완료) */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">정산 대상 (발송 완료 {settleList.length})</h3>
        {settleList.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-3">발송 완료된 교환이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {settleList.map((r) => (
              <li key={r.id} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">🎁 {r.itemName}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {r.partner?.trim() || "(제휴사 미지정)"} · 원가{" "}
                      {r.costKrw != null ? won(r.costKrw) : <span className="text-rose-500">미입력</span>} · 액면{" "}
                      {won(r.points)}
                    </p>
                    <p className="text-[11px] text-ink-3">
                      {r.user.nickname} · {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  {r.settledAt ? (
                    <form action={unsettleRedemption}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="shrink-0 rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        ✓ 정산완료 (취소)
                      </button>
                    </form>
                  ) : (
                    <form action={settleRedemption}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:bg-surface-2">
                        정산완료 처리
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-ink-3">
        · 마진 = 포인트 사용(소비자 액면) − 원가(실지출). 원가·제휴사는 ‘기프티콘 상품’에서 상품별로 입력해요.
        <br />· 실 제휴사 API 자동발송·자동정산은 제휴 계약 후 연동돼요(현재는 수동 발송·수동 정산).
      </p>
    </div>
  );
}
