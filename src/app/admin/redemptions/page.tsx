import { prisma } from "@/lib/prisma";
import { markRedemptionSent, cancelRedemption, settleRedemption, unsettleRedemption } from "../actions";

/** 기프티콘 교환 관리 (관리자): 신청 목록 → 등록 연락처로 발송 후 완료 처리 / 취소(환원). */
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  requested: "발송 대기",
  sent: "발송 완료",
  canceled: "취소됨",
};

export default async function AdminRedemptions() {
  let rows: {
    id: string;
    itemName: string;
    points: number;
    contact: string;
    status: string;
    costKrw: number | null;
    partner: string | null;
    settledAt: Date | null;
    createdAt: Date;
    user: { nickname: string };
  }[] = [];
  let dbError = false;
  try {
    rows = await prisma.redemption.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        itemName: true,
        points: true,
        contact: true,
        status: true,
        costKrw: true,
        partner: true,
        settledAt: true,
        createdAt: true,
        user: { select: { nickname: true } },
      },
    });
  } catch {
    dbError = true;
  }

  if (dbError) {
    return <p className="py-10 text-center text-sm text-gray-400">교환 내역을 불러오지 못했어요.</p>;
  }

  const pending = rows.filter((r) => r.status === "requested").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">기프티콘 교환</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-700">발송 대기 {pending}</span>
      </div>
      <p className="text-xs text-gray-400">
        외부 기프티콘 전문샵에서 구매해 아래 <b>연락처(문자)</b>로 보낸 뒤 ‘발송 완료’를 눌러 주세요.
      </p>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">교환 내역이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">🎁 {r.itemName}</p>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {r.user.nickname} · <span className="font-medium">{r.contact}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleString("ko-KR")} · {r.points.toLocaleString("ko-KR")}P
                  </p>
                  {(r.partner || r.costKrw != null) && (
                    <p className="text-[11px] text-gray-400">
                      {r.partner?.trim() || "제휴사 미지정"}
                      {r.costKrw != null && ` · 원가 ${r.costKrw.toLocaleString("ko-KR")}원`}
                      {r.status === "sent" && (
                        <span className={r.settledAt ? "ml-1 text-emerald-600" : "ml-1 text-rose-500"}>
                          · {r.settledAt ? "정산완료" : "미정산"}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <span
                  className={[
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    r.status === "requested"
                      ? "bg-amber-100 text-amber-700"
                      : r.status === "sent"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500",
                  ].join(" ")}
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              {r.status === "requested" && (
                <div className="mt-2 flex justify-end gap-2">
                  <form action={cancelRedemption}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                      취소(환원)
                    </button>
                  </form>
                  <form action={markRedemptionSent}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                      발송 완료
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
