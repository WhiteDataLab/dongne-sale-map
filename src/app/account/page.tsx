import Link from "next/link";
import { cookies } from "next/headers";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META, type Category } from "@/lib/constants";
import { POINT_EXPIRY_YEARS, POINT_HISTORY_YEARS, yearsAgo } from "@/lib/points";
import { deleteAccount, startLink, updateNickname } from "./actions";

const LINK_RESULT_MSG: Record<string, string> = {
  linked: "계정이 연결됐어요.",
  merged: "계정이 통합됐어요! 포인트와 즐겨찾기가 합쳐졌어요.",
  already: "이미 연결된 계정이에요.",
  error: "연결 처리 중 문제가 생겼어요.",
};

/** 마이페이지 (스펙 Phase 5 착수): 프로필 + 즐겨찾기 + 약관 + 회원 탈퇴. */
export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-gray-500">
        <p className="mt-10">로그인이 필요해요.</p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: "/account" });
          }}
        >
          <button className="mt-3 rounded-full bg-[#03C75A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#02b350] active:bg-[#029a45]">
            네이버 로그인
          </button>
        </form>
        <Link href="/" className="mt-4 inline-block text-blue-600">
          ← 지도로
        </Link>
      </div>
    );
  }

  const naverEnabled = Boolean(process.env.AUTH_NAVER_ID && process.env.AUTH_NAVER_SECRET);
  const kakaoEnabled = Boolean(process.env.AUTH_KAKAO_ID && process.env.AUTH_KAKAO_SECRET);
  const linkResult = (await cookies()).get("link_result")?.value;

  let connected = new Set<string>();
  try {
    const ids = await prisma.identity.findMany({
      where: { userId: session.user.id },
      select: { provider: true },
    });
    connected = new Set(ids.map((i) => i.provider));
  } catch {
    // DB 미연결
  }

  const linkNaver = startLink.bind(null, "naver");
  const linkKakao = startLink.bind(null, "kakao");

  // 포인트: 잔액 = PointLog 합계(5년 이내), 내역 = 최근 2년만 노출
  // 표시 닉네임은 DB 최신값(세션 토큰 지연 회피)
  let nickname = session.user.name ?? "이웃";
  try {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { nickname: true },
    });
    if (me) nickname = me.nickname;
  } catch {
    // DB 미연결
  }

  let balance = 0;
  let history: {
    id: string;
    amount: number;
    reason: string;
    status: string;
    createdAt: Date;
  }[] = [];
  try {
    const agg = await prisma.pointLog.aggregate({
      _sum: { amount: true },
      where: { userId: session.user.id, createdAt: { gte: yearsAgo(POINT_EXPIRY_YEARS) } },
    });
    balance = agg._sum.amount ?? 0;
    history = await prisma.pointLog.findMany({
      where: { userId: session.user.id, createdAt: { gte: yearsAgo(POINT_HISTORY_YEARS) } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, amount: true, reason: true, status: true, createdAt: true },
    });
  } catch {
    // DB 미연결
  }

  let favorites: { id: string; name: string; category: Category; address: string }[] = [];
  try {
    const rows = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: {
        store: { select: { id: true, name: true, category: true, address: true, status: true } },
      },
    });
    favorites = rows
      .filter((r) => r.store.status === "active")
      .map((r) => ({
        id: r.store.id,
        name: r.store.name,
        category: r.store.category as Category,
        address: r.store.address,
      }));
  } catch {
    // DB 미연결 → 빈 목록
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-5 p-5">
        <Link href="/" className="text-sm text-gray-400">
          ← 지도로
        </Link>

        <section>
          <h1 className="text-xl font-bold">마이페이지</h1>
          <div className="mt-3 rounded-xl border border-gray-200 p-4">
            <p className="font-medium">{nickname}님</p>
            <form action={updateNickname} className="mt-2 flex gap-2">
              <input
                name="nickname"
                defaultValue={nickname}
                maxLength={20}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                aria-label="닉네임"
              />
              <button className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200">
                닉네임 저장
              </button>
            </form>
            <p className="mt-2 text-sm text-gray-500">
              적립 포인트{" "}
              <span className="font-semibold text-gray-800">{balance}P</span>
              <span className="ml-1 text-xs text-gray-400">(표시용, 실지급 없음)</span>
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">포인트 내역</h2>
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
              최근 2년간 적립 내역이 없어요.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{h.reason}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(h.createdAt).toLocaleDateString("ko-KR")} ·{" "}
                      {h.status === "granted" ? "지급" : "적립예정"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-blue-600">
                    +{h.amount}P
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-xs text-gray-400">
            내역은 최근 {POINT_HISTORY_YEARS}년까지 표시되며, 적립 후 {POINT_EXPIRY_YEARS}년이 지난
            포인트는 소멸돼요.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">연결된 로그인 수단</h2>
          {linkResult && LINK_RESULT_MSG[linkResult] && (
            <p
              className={`mb-2 rounded-lg px-3 py-2 text-xs ${
                linkResult === "conflict"
                  ? "bg-red-50 text-red-600"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {LINK_RESULT_MSG[linkResult]}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {[
              { key: "naver", label: "네이버", enabled: naverEnabled, action: linkNaver },
              { key: "kakao", label: "카카오", enabled: kakaoEnabled, action: linkKakao },
              { key: "phone", label: "전화번호", enabled: false, action: null },
            ].map((p) => (
              <li
                key={p.key}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              >
                <span className="font-medium">{p.label}</span>
                {connected.has(p.key) ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    연결됨
                  </span>
                ) : p.enabled && p.action ? (
                  <form action={p.action}>
                    <button className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200">
                      연결하기
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-gray-300">미연결</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            즐겨찾기한 가게 {favorites.length > 0 && `(${favorites.length})`}
          </h2>
          {favorites.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
              아직 즐겨찾기한 가게가 없어요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {favorites.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3"
                >
                  <span className="text-xl" aria-hidden>
                    {CATEGORY_META[f.category].icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.name}</p>
                    <p className="truncate text-xs text-gray-400">{f.address}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex gap-4 text-sm">
          <Link
            href="/terms"
            className="text-gray-600 underline-offset-2 transition-colors hover:text-gray-900 hover:underline"
          >
            이용약관
          </Link>
          <Link
            href="/privacy"
            className="text-gray-600 underline-offset-2 transition-colors hover:text-gray-900 hover:underline"
          >
            개인정보처리방침
          </Link>
        </section>

        <section className="mt-4 border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-gray-700">회원 탈퇴</h2>
          <p className="mt-1 text-xs text-gray-500">
            탈퇴 시 개인정보(닉네임·프로필·소셜 식별자)는 즉시 삭제돼요. 작성하신 가게·세일은
            ‘탈퇴한 사용자’로 익명 처리되고, 리뷰·즐겨찾기·포인트 기록은 함께 삭제돼요. 되돌릴 수
            없어요.
          </p>
          <form action={deleteAccount} className="mt-3">
            <button className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 active:bg-red-100">
              회원 탈퇴 및 데이터 삭제
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
