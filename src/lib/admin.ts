import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

/**
 * 관리자(role=admin) 세션이면 반환, 아니면 null. 관리 화면·서버액션 가드에 사용.
 * 토큰 role 만 믿지 않고 **DB 의 최신 role/status 를 재확인**(강등/정지된 관리자 즉시 차단).
 */
export async function getAdminSession(): Promise<Session | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  try {
    const u = await prisma.user.findUnique({
      where: { id },
      select: { role: true, status: true },
    });
    return u?.role === "admin" && u.status === "active" ? session : null;
  } catch {
    // DB 불가 시: 토큰 role 로 폴백(가용성 유지)
    return session?.user?.role === "admin" ? session : null;
  }
}
