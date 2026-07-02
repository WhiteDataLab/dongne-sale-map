import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getLaunchFlags } from "@/lib/launchFlags";
import { getPointConfig } from "@/lib/pointConfig";
import { SideNav } from "./SideNav";

/**
 * 앱 헤더: 좌측 슬라이드 드로어(SideNav) 트리거 + 타이틀 + (로그아웃 시)빠른 로그인.
 * 로그인/로그아웃은 인라인 서버 액션을 SideNav(클라이언트)에 prop 으로 전달.
 */
export async function Header() {
  const session = await auth();
  const flags = await getLaunchFlags();
  const referralPoint = (await getPointConfig()).referral;
  const user = session?.user
    ? {
        name: session.user.name ?? "이웃",
        image: session.user.image ?? null,
        isAdmin: session.user.role === "admin",
        isMerchant: session.user.role === "merchant" || session.user.role === "admin",
      }
    : null;
  async function logoutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="z-20 flex items-center gap-2 border-b border-line bg-white px-3 py-3">
      <SideNav
        user={user}
        logoutAction={logoutAction}
        showReservations={flags.reservations}
        referralPoint={referralPoint}
      />
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="shrink-0 text-lg font-bold tracking-tight">동네 세일 지도</h1>
        {/* 콜드스타트 P0-5: 0.5초에 뜻이 통하는 정체성 한 줄(브랜드명 확정 전 카피) */}
        <p className="hidden truncate text-xs font-medium text-ink-3 sm:block">
          우리 동네 오늘의 떨이·세일
        </p>
      </div>

      <div className="ml-auto">
        {!user && (
          <Link
            href="/login"
            className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-ink active:bg-blue-800"
          >
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
