import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { reviewDateLabel } from "@/lib/format";

export const metadata = { title: "공지 · 이벤트 — 동네 세일 지도" };
export const dynamic = "force-dynamic";

/** 공지/이벤트 공개 목록 (P1). */
export default async function NoticesPage() {
  let notices: {
    id: string;
    kind: string;
    title: string;
    body: string;
    pinned: boolean;
    createdAt: Date;
  }[] = [];
  try {
    notices = await prisma.notice.findMany({
      where: { active: true },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: { id: true, kind: true, title: true, body: true, pinned: true, createdAt: true },
    });
  } catch {
    // DB 미연결
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-5">
        <Link href="/" className="text-sm text-ink-3">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-ink">공지 · 이벤트</h1>

        {notices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-3">
            아직 등록된 공지가 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notices.map((n) => (
              <li key={n.id} className="rounded-xl border border-line">
                <details className="group" open={n.pinned}>
                  <summary className="flex cursor-pointer items-center gap-2 p-4">
                    <span
                      className={[
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        n.kind === "event" ? "bg-pink-100 text-pink-700" : "bg-brand-wash text-brand-ink",
                      ].join(" ")}
                    >
                      {n.kind === "event" ? "이벤트" : "공지"}
                    </span>
                    {n.pinned && <span className="shrink-0 text-xs text-amber-600">📌</span>}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {n.title}
                    </span>
                    <span className="shrink-0 text-xs text-ink-3">
                      {reviewDateLabel(n.createdAt.toISOString())}
                    </span>
                  </summary>
                  <p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-relaxed text-ink-2">
                    {n.body}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
