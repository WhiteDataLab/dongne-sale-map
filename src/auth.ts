import NextAuth, { type NextAuthConfig } from "next-auth";
import Kakao from "next-auth/providers/kakao";
import Naver from "next-auth/providers/naver";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  linkOrMergeIdentity,
  resolvePhoneUser,
  resolveSocialUser,
} from "@/lib/userIdentity";
import { hashCode, normalizePhone } from "@/lib/sms";

/**
 * NextAuth (Auth.js v5) 설정.
 * - 세션 전략 JWT. 신원의 단일 출처는 Identity 테이블(@/lib/userIdentity).
 * - 소셜(kakao/naver) + 전화번호(Credentials "phone") 로그인.
 * - 계정 연결(account linking): 로그인 상태에서 link_uid 쿠키가 있으면 신원을 현재 User 에 붙인다.
 * - 환경변수 가드: 키 없는 프로바이더는 제외(빌드/기동 무손상).
 */
const providers: NextAuthConfig["providers"] = [];

if (process.env.AUTH_KAKAO_ID && process.env.AUTH_KAKAO_SECRET) {
  providers.push(
    Kakao({
      clientId: process.env.AUTH_KAKAO_ID,
      clientSecret: process.env.AUTH_KAKAO_SECRET,
    }),
  );
}

if (process.env.AUTH_NAVER_ID && process.env.AUTH_NAVER_SECRET) {
  providers.push(
    Naver({
      clientId: process.env.AUTH_NAVER_ID,
      clientSecret: process.env.AUTH_NAVER_SECRET,
    }),
  );
}

// 전화번호 로그인 (사전에 /api/phone/verify 로 본인확인된 코드를 소비).
providers.push(
  Credentials({
    id: "phone",
    name: "전화번호",
    credentials: { phone: {}, code: {}, nickname: {}, name: {} },
    authorize: async (creds) => {
      const phone = normalizePhone(String(creds?.phone ?? ""));
      const code = String(creds?.code ?? "");
      if (!phone || !/^\d{4,6}$/.test(code)) return null;

      const rec = await prisma.phoneVerification.findFirst({
        where: { phone, verified: true, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
      if (!rec || rec.codeHash !== hashCode(phone, code)) return null;

      await prisma.phoneVerification.deleteMany({ where: { phone } }); // 1회용 소비
      const dbUser = await resolvePhoneUser(phone, {
        nickname: creds?.nickname ? String(creds.nickname) : null,
        name: creds?.name ? String(creds.name) : null,
      });
      return { id: dbUser.id, name: dbUser.nickname, image: dbUser.profileImgUrl };
    },
  }),
);

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, user, trigger }) {
      // 세션 갱신(예: 마이페이지 닉네임 변경) → DB 에서 최신값 반영
      if (trigger === "update" && token.userId) {
        try {
          const u = await prisma.user.findUnique({ where: { id: token.userId as string } });
          if (u) {
            token.nickname = u.nickname;
            token.role = u.role;
            token.points = u.points;
            token.picture = u.profileImgUrl ?? null;
          }
        } catch {
          // 무시
        }
        return token;
      }

      if (!account || !user) return token;
      try {
        if (account.provider === "kakao" || account.provider === "naver") {
          const provider = account.provider;
          const providerId = account.providerAccountId;

          // 계정 연결 모드: 로그인 상태에서 시작한 연결이면 신원을 현재 User 에 붙인다.
          // 쿠키 접근 실패가 일반 로그인을 깨지 않도록 격리한다.
          let linkUid: string | undefined;
          try {
            linkUid = (await cookies()).get("link_uid")?.value;
          } catch {
            linkUid = undefined;
          }
          if (linkUid) {
            const result = await linkOrMergeIdentity(linkUid, provider, providerId);
            try {
              const jar = await cookies();
              jar.delete("link_uid");
              jar.set("link_result", result.status, { maxAge: 30, path: "/" });
            } catch {
              // 쿠키 정리 실패는 무시 (link_uid 는 짧은 maxAge 로 자동 만료)
            }
            const u = result.user;
            if (u) {
              token.userId = u.id;
              token.role = u.role;
              token.points = u.points;
              token.nickname = u.nickname;
              token.picture = u.profileImgUrl ?? null;
            }
            return token;
          }

          const dbUser = await resolveSocialUser(provider, providerId, {
            nickname: user.name?.trim() || "이웃",
            profileImgUrl: user.image ?? null,
            email: user.email ?? null,
          });
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.points = dbUser.points;
          token.nickname = dbUser.nickname;
          token.picture = dbUser.profileImgUrl ?? null;
        } else {
          // 전화번호(Credentials): authorize 가 반환한 user.id 가 우리 User.id.
          const dbUser = await prisma.user.findUnique({ where: { id: user.id! } });
          if (dbUser) {
            token.userId = dbUser.id;
            token.role = dbUser.role;
            token.points = dbUser.points;
            token.nickname = dbUser.nickname;
            token.picture = dbUser.profileImgUrl ?? null;
          }
        }
      } catch {
        // DB 불가 시에도 로그인 자체는 유지(단, userId 없음 → 작성 기능 차단)
      }
      return token;
    },
    async session({ session, token }) {
      // NextAuth v5 의 JWT 인덱스 시그니처 때문에 명시 캐스팅한다.
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as "user" | "admin" | "merchant") ?? "user";
        session.user.points = (token.points as number) ?? 0;
        if (token.nickname) session.user.name = token.nickname as string;
        session.user.image = (token.picture as string | null) ?? null;
      }
      return session;
    },
  },
};

export const { handlers, signIn, signOut, auth, unstable_update } =
  NextAuth(authConfig);
