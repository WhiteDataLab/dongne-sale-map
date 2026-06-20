import { prisma } from "@/lib/prisma";
import { unbanUser } from "../actions";

/** 정지 계정 관리 (Phase 7b-2): 정지된 사용자 목록 + 정지 해제. */
export default async function AdminUsers() {
  let banned: { id: string; nickname: string; createdAt: Date }[] = [];
  try {
    banned = await prisma.user.findMany({
      where: { status: "banned" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, nickname: true, createdAt: true },
    });
  } catch {
    // DB 미연결
  }

  if (banned.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-3">정지된 계정이 없어요.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {banned.map((u) => (
        <li
          key={u.id}
          className="flex items-center justify-between rounded-xl border border-line p-3"
        >
          <div>
            <p className="font-medium">{u.nickname}</p>
            <p className="text-xs text-ink-3">가입 {new Date(u.createdAt).toLocaleDateString("ko-KR")}</p>
          </div>
          <form action={unbanUser}>
            <input type="hidden" name="id" value={u.id} />
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2">
              정지 해제
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
