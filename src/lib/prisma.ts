import { PrismaClient } from "@prisma/client";

/**
 * Prisma 클라이언트 싱글톤.
 * 서버리스/HMR 환경에서 커넥션 폭주를 막기 위해 globalThis 에 캐싱한다.
 * (Phase 0에서는 아직 어디서도 import 하지 않음 — Phase 1+ 데이터 접근에서 사용)
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
