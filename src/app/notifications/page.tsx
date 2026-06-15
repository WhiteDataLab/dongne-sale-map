import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NotificationList, type NotificationItem } from "@/components/NotificationList";
import { getMyStoreAlerts } from "@/lib/alerts";

export const metadata = { title: "알림 — 동네 세일 지도" };
export const dynamic = "force-dynamic";

const REDEMPTION_NOTI: Record<string, { icon: string; title: string }> = {
  sent: { icon: "🎁", title: "기프티콘이 발송됐어요" },
  canceled: { icon: "↩️", title: "기프티콘 교환이 취소됐어요(포인트 환원)" },
};

/**
 * 인앱 알림함 (P1). 별도 알림 테이블 없이 기존 데이터에서 파생:
 *  - 플랫폼 공지/이벤트(Notice)
 *  - 내 1:1 문의 답변 완료(Inquiry.answered)
 *  - 내 기프티콘 교환 상태 변경(Redemption sent/canceled)
 * 읽음 상태는 클라이언트(localStorage)에서 처리.
 */
export default async function NotificationsPage() {
  const session = await auth();
  const items: NotificationItem[] = [];

  try {
    const notices = await prisma.notice.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, kind: true, title: true, body: true, createdAt: true },
    });
    for (const n of notices) {
      items.push({
        id: `notice-${n.id}`,
        icon: n.kind === "event" ? "🎉" : "📢",
        title: `[${n.kind === "event" ? "이벤트" : "공지"}] ${n.title}`,
        body: n.body,
        href: "/notices",
        createdAt: n.createdAt.toISOString(),
      });
    }

    if (session?.user) {
      // M9: 내가 즐겨찾기한 가게의 세일/소식 알림(팔로우 이후·최근 30일).
      const storeAlerts = await getMyStoreAlerts(session.user.id);
      for (const a of storeAlerts) {
        items.push({
          id: `alert-${a.id}`,
          icon: a.kind === "sale" ? "🔥" : "📣",
          title: `${a.storeName} · ${a.title}`,
          body: a.body,
          href: `/?store=${a.storeId}`,
          createdAt: a.createdAt,
        });
      }

      const [inquiries, redemptions] = await Promise.all([
        prisma.inquiry.findMany({
          where: { userId: session.user.id, status: "answered" },
          orderBy: { answeredAt: "desc" },
          take: 20,
          select: { id: true, title: true, answer: true, answeredAt: true, createdAt: true },
        }),
        prisma.redemption.findMany({
          where: { userId: session.user.id, status: { in: ["sent", "canceled"] } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, itemName: true, status: true, sentAt: true, createdAt: true },
        }),
      ]);

      for (const q of inquiries) {
        items.push({
          id: `inq-${q.id}`,
          icon: "💬",
          title: "문의에 답변이 등록됐어요",
          body: `‘${q.title}’ — ${q.answer ?? "고객센터에서 확인해 주세요."}`,
          href: "/support",
          createdAt: (q.answeredAt ?? q.createdAt).toISOString(),
        });
      }
      for (const r of redemptions) {
        const meta = REDEMPTION_NOTI[r.status] ?? { icon: "🎁", title: "기프티콘 교환 상태가 변경됐어요" };
        items.push({
          id: `rdm-${r.id}`,
          icon: meta.icon,
          title: meta.title,
          body: r.itemName,
          href: "/account",
          createdAt: (r.sentAt ?? r.createdAt).toISOString(),
        });
      }
    }
  } catch {
    // DB 미연결
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-5">
        <Link href="/" className="text-sm text-gray-400">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">알림</h1>
        <NotificationList items={items.slice(0, 60)} />
        {!session?.user && (
          <p className="text-center text-xs text-gray-400">
            로그인하면 내 문의·교환 알림도 함께 볼 수 있어요.
          </p>
        )}
      </div>
    </div>
  );
}
