import type { DefaultSession } from "next-auth";

// 세션/JWT 에 우리 도메인 필드(User.id, role, points) 를 얹는다.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
      points: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: "user" | "admin";
    points?: number;
    nickname?: string;
  }
}
