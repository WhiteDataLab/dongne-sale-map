import { auth } from "@/auth";
import type { Session } from "next-auth";

/** 관리자(role=admin) 세션이면 반환, 아니면 null. 관리 화면·서버액션 가드에 사용. */
export async function getAdminSession(): Promise<Session | null> {
  const session = await auth();
  return session?.user?.role === "admin" ? session : null;
}
