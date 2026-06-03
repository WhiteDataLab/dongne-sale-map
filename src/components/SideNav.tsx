"use client";

import { useState } from "react";
import Link from "next/link";

type NavUser = { name: string; image: string | null; isAdmin: boolean } | null;

/**
 * 왼쪽 슬라이드 드로어 네비게이션.
 * 트리거(프로필 사진 또는 ☰) → 좌측 패널 슬라이드. 프로필 + 마이페이지/관리/약관/로그아웃.
 * 로그인/로그아웃은 서버 액션(props)으로 처리.
 */
export function SideNav({
  user,
  logoutAction,
}: {
  user: NavUser;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const itemClass =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-9 rounded-full object-cover" />
        ) : (
          "☰"
        )}
      </button>

      <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
        {/* 백드롭 */}
        <div
          onClick={close}
          className={`absolute inset-0 bg-black transition-opacity duration-200 ${
            open ? "opacity-40" : "opacity-0"
          }`}
        />
        {/* 패널 */}
        <aside
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-white shadow-2xl transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* 프로필 영역 */}
          <div className="flex items-center gap-3 border-b border-gray-100 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xl">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="size-12 object-cover" />
              ) : (
                "🙂"
              )}
            </div>
            <div className="min-w-0">
              {user ? (
                <p className="truncate font-semibold">{user.name}님</p>
              ) : (
                <p className="text-sm text-gray-500">로그인하고 시작해요</p>
              )}
            </div>
          </div>

          {/* 메뉴 */}
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            <Link href="/" onClick={close} className={itemClass}>
              🗺️ 지도
            </Link>
            <Link href="/stores/new" onClick={close} className={itemClass}>
              ➕ 가게 등록
            </Link>
            {user && (
              <Link href="/account" onClick={close} className={itemClass}>
                👤 마이페이지
              </Link>
            )}
            {user?.isAdmin && (
              <Link href="/admin" onClick={close} className={itemClass}>
                🛠️ 관리
              </Link>
            )}
            <Link href="/terms" onClick={close} className={itemClass}>
              📄 이용약관
            </Link>
            <Link href="/privacy" onClick={close} className={itemClass}>
              🔒 개인정보처리방침
            </Link>
          </nav>

          {/* 하단: 로그인/로그아웃 */}
          <div className="border-t border-gray-100 p-3">
            {user ? (
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200"
                >
                  로그아웃
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                onClick={close}
                className="block w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
              >
                로그인 / 회원가입
              </Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
