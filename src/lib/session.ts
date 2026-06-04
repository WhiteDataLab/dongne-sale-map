import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * 현재 로그인 사용자(id+role). DB에서 status 확인 → **정지(banned) 계정은 null**(작성 차단).
 * 권한 판정/작성 가드에 사용. role 도 DB 최신값을 사용.
 */
export async function getCurrentUser(): Promise<
  { id: string; role: "user" | "admin" | "merchant" } | null
> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  try {
    const u = await prisma.user.findUnique({
      where: { id },
      select: { role: true, status: true },
    });
    if (!u || u.status === "banned") return null;
    return { id, role: u.role };
  } catch {
    // DB 불가 시: 로그인 자체는 유지(밴 확인 불가) — 세션 role 사용
    return { id, role: session.user.role };
  }
}

/** 현재 로그인 사용자의 User.id (정지 계정 또는 비로그인 시 null). */
export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}
