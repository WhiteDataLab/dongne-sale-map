"use client";

import { useState } from "react";
import Link from "next/link";

type NavUser = { name: string; image: string | null; isAdmin: boolean; isMerchant?: boolean } | null;

/**
 * 왼쪽 슬라이드 드로어 네비게이션.
 * IA: 탐색 / 기여 / 혜택 / 내 정보 / 고객지원 / 관리 그룹 + 하단 약관·정책 묶음.
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
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 active:bg-gray-200";
  const groupLabel = "px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-3";

  const Item = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link href={href} onClick={close} className={itemClass}>
      {children}
    </Link>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          // 지도에 열려있는 가게 등록/상세 패널 닫기 (MapExplorer가 수신)
          window.dispatchEvent(new CustomEvent("app:overlay-close"));
        }}
        aria-label="메뉴 열기"
        className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl text-ink-2 transition-colors hover:bg-surface-2 active:bg-gray-200"
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
          {/* 프로필 영역 — 로그인 시 누르면 마이페이지(사진 변경)로 */}
          {user ? (
            <Link
              href="/account"
              onClick={close}
              className="flex items-center gap-3 border-b border-line-2 p-4 transition-colors hover:bg-surface-2"
            >
              <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-xl">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" className="size-12 object-cover" />
                ) : (
                  "🙂"
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.name}님</p>
                <p className="text-xs text-ink-3">프로필 사진 변경 ›</p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3 border-b border-line-2 p-4">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-xl">
                🙂
              </div>
              <p className="text-sm text-ink-3">로그인하고 시작해요</p>
            </div>
          )}

          {/* 메뉴 (그룹핑) */}
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {user?.isMerchant && (
              <>
                <p className={groupLabel}>사장님</p>
                <Item href="/manage">⚙️ 내 가게 관리</Item>
              </>
            )}
            <p className={groupLabel}>탐색</p>
            <Item href="/">🗺️ 지도</Item>
            {user && <Item href="/favorites">♥ 즐겨찾기</Item>}
            <Item href="/news">📰 동네 소식</Item>

            <p className={groupLabel}>기여</p>
            <Item href="/?register=1">➕ 가게 등록</Item>

            {user && (
              <>
                <p className={groupLabel}>혜택</p>
                <Item href="/checkin">✅ 출석체크</Item>
                <Item href="/coupons">🎟️ 내 쿠폰</Item>
                <Item href="/reservations">🏃 내 예약</Item>
                <Item href="/shop">🎁 포인트샵</Item>
                <Item href="/invite">🎉 친구 초대 (+50P)</Item>
                <Item href="/notices">📢 공지 · 이벤트</Item>

                <p className={groupLabel}>내 정보</p>
                <Item href="/account">👤 마이페이지</Item>
                <Item href="/notifications">🔔 알림</Item>
                <Item href="/settings">⚙️ 설정</Item>
              </>
            )}

            <p className={groupLabel}>고객지원</p>
            {user && <Item href="/support">🎧 고객센터</Item>}
            <Item href="/faq">❓ 자주 묻는 질문</Item>

            {user?.isAdmin && (
              <>
                <p className={groupLabel}>관리</p>
                <Item href="/admin">🛠️ 관리 콘솔</Item>
              </>
            )}

            {/* 약관·정책 (푸터 묶음) */}
            <div className="mt-3 border-t border-line-2 px-3 pt-3">
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-ink-3">
                <Link href="/about" onClick={close} className="hover:text-ink-2">서비스 소개</Link>
                <Link href="/terms" onClick={close} className="hover:text-ink-2">이용약관</Link>
                <Link href="/privacy" onClick={close} className="hover:text-ink-2">개인정보처리방침</Link>
                <Link href="/location-terms" onClick={close} className="hover:text-ink-2">위치기반 약관</Link>
                <Link href="/policy" onClick={close} className="hover:text-ink-2">운영정책</Link>
                <Link href="/refund" onClick={close} className="hover:text-ink-2">교환/환불</Link>
                <Link href="/company" onClick={close} className="hover:text-ink-2">운영 정보</Link>
                <Link href="/sitemap" onClick={close} className="hover:text-ink-2">사이트맵</Link>
              </div>
            </div>
          </nav>

          {/* 하단: 로그인/로그아웃 */}
          <div className="border-t border-line-2 p-3">
            {user ? (
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 active:bg-gray-200"
                >
                  로그아웃
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                onClick={close}
                className="block w-full rounded-lg bg-brand py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-brand-ink active:bg-blue-800"
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
