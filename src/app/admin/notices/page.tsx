import { prisma } from "@/lib/prisma";
import { NoticeAdmin, type AdminNotice } from "@/components/NoticeAdmin";

/** 관리자: 공지/이벤트 관리. */
export default async function AdminNoticesPage() {
  let notices: AdminNotice[] = [];
  try {
    const rows = await prisma.notice.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    notices = rows.map((n) => ({
      id: n.id,
      kind: n.kind as "notice" | "event",
      title: n.title,
      body: n.body,
      pinned: n.pinned,
      active: n.active,
      createdAt: n.createdAt.toISOString(),
    }));
  } catch {
    // DB 미연결
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">공지 · 이벤트 관리</h1>
      <NoticeAdmin notices={notices} />
    </div>
  );
}
