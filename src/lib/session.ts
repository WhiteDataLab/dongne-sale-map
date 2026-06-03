import { auth } from "@/auth";

/** 현재 로그인 사용자의 DB User.id (없으면 null). 작성 API 의 인증 가드에 사용. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
