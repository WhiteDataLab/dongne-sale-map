import { auth } from "@/auth";

/** 현재 로그인 사용자의 DB User.id (없으면 null). 작성 API 의 인증 가드에 사용. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** 현재 로그인 사용자(id+role). 권한 판정에 사용. */
export async function getCurrentUser(): Promise<
  { id: string; role: "user" | "admin" | "merchant" } | null
> {
  const session = await auth();
  return session?.user?.id
    ? { id: session.user.id, role: session.user.role }
    : null;
}
