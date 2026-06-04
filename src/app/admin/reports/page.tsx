import { prisma } from "@/lib/prisma";
import { hideAndResolve, resolveReport } from "../actions";

const TYPE_LABEL: Record<string, string> = {
  store: "가게",
  sale: "세일",
  review: "리뷰",
  product: "메뉴",
};

/** 대상 콘텐츠의 간단 라벨을 벌크로 조회. */
async function buildLabels(
  reports: { targetType: string; targetId: string }[],
): Promise<Map<string, string>> {
  const ids = (t: string) =>
    reports.filter((r) => r.targetType === t).map((r) => r.targetId);
  const [stores, sales, reviews, products] = await Promise.all([
    prisma.store.findMany({ where: { id: { in: ids("store") } }, select: { id: true, name: true } }),
    prisma.sale.findMany({ where: { id: { in: ids("sale") } }, select: { id: true, title: true } }),
    prisma.review.findMany({ where: { id: { in: ids("review") } }, select: { id: true, content: true } }),
    prisma.product.findMany({ where: { id: { in: ids("product") } }, select: { id: true, name: true } }),
  ]);
  const map = new Map<string, string>();
  stores.forEach((s) => map.set(s.id, s.name));
  sales.forEach((s) => map.set(s.id, s.title));
  reviews.forEach((r) => map.set(r.id, r.content.slice(0, 30)));
  products.forEach((p) => map.set(p.id, p.name));
  return map;
}

export default async function AdminReports() {
  let reports: Awaited<ReturnType<typeof prisma.report.findMany>> = [];
  let labels = new Map<string, string>();
  try {
    reports = await prisma.report.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    labels = await buildLabels(reports);
  } catch {
    // DB 미연결
  }

  if (reports.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">처리할 신고가 없어요.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {reports.map((r) => (
        <li key={r.id} className="rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {TYPE_LABEL[r.targetType] ?? r.targetType}
            </span>
            <span className="truncate text-sm font-medium">
              {labels.get(r.targetId) ?? "(삭제됨)"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-700">사유: {r.reason}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {new Date(r.createdAt).toLocaleString("ko-KR")}
          </p>

          <div className="mt-2 flex gap-2">
            <form action={hideAndResolve}>
              <input type="hidden" name="reportId" value={r.id} />
              <input type="hidden" name="targetType" value={r.targetType} />
              <input type="hidden" name="targetId" value={r.targetId} />
              <button className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 active:bg-red-700">
                콘텐츠 숨김 + 종료
              </button>
            </form>
            <form action={resolveReport}>
              <input type="hidden" name="id" value={r.id} />
              <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200">
                반려(처리완료)
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
