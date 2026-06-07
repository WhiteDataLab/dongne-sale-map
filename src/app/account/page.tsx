import Link from "next/link";
import { cookies } from "next/headers";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { POINT_EXPIRY_YEARS, POINT_HISTORY_YEARS, yearsAgo } from "@/lib/points";
import { reviewDateLabel } from "@/lib/format";
import { deleteAccount, startLink, updateNickname } from "./actions";
import { ProfileAvatarEditor } from "@/components/ProfileAvatarEditor";
import { ContactVerifyForm } from "@/components/ContactVerifyForm";
import { PointHistory } from "@/components/PointHistory";
import { MyReviewItem } from "@/components/MyReviewItem";

const REDEMPTION_LABEL: Record<string, string> = {
  requested: "발송 대기",
  sent: "발송 완료",
  canceled: "취소(환원)",
};

/** 활동 점수 → 신뢰/활동 배지 (관리자 활동분석과 동일 가중치). */
function activityBadge(score: number): { emoji: string; label: string; color: string } {
  if (score >= 100) return { emoji: "🌟", label: "동네 스타", color: "bg-amber-100 text-amber-700" };
  if (score >= 50) return { emoji: "🏅", label: "동네 지킴이", color: "bg-purple-100 text-purple-700" };
  if (score >= 20) return { emoji: "💪", label: "단골 이웃", color: "bg-blue-100 text-blue-700" };
  if (score >= 5) return { emoji: "🌱", label: "새싹 이웃", color: "bg-green-100 text-green-700" };
  return { emoji: "👋", label: "새내기", color: "bg-gray-100 text-gray-600" };
}

type TimelineItem = { id: string; icon: string; text: string; href: string; date: Date };

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
  let profileImg: string | null = session.user.image ?? null;
  let contactPhone: string | null = null;
  try {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { nickname: true, profileImgUrl: true, contactPhone: true },
    });
    if (me) {
      nickname = me.nickname;
      profileImg = me.profileImgUrl;
      contactPhone = me.contactPhone;
    }
  } catch {
    // DB 미연결
  }

  let redemptions: { id: string; itemName: string; points: number; status: string; createdAt: Date }[] = [];
  try {
    redemptions = await prisma.redemption.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, itemName: true, points: true, status: true, createdAt: true },
    });
  } catch {
    // DB 미연결
  }

  let myReviews: {
    id: string;
    storeId: string;
    rating: number;
    content: string;
    tags: string[];
    productIds: string[];
    photoUrls: string[];
    receiptUrl: string | null;
    scored: boolean;
    createdAt: Date;
    store: { name: string };
  }[] = [];
  const productNameMap = new Map<string, string>();
  try {
    myReviews = await prisma.review.findMany({
      where: { userId: session.user.id, hidden: false },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        storeId: true,
        rating: true,
        content: true,
        tags: true,
        productIds: true,
        photoUrls: true,
        receiptUrl: true,
        scored: true,
        createdAt: true,
        store: { select: { name: true } },
      },
    });
    // 연결된 구매 메뉴 이름 해석(현재 존재하는 상품만)
    const ids = Array.from(new Set(myReviews.flatMap((r) => r.productIds)));
    if (ids.length > 0) {
      const prods = await prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      for (const p of prods) productNameMap.set(p.id, p.name);
    }
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
    balance = Math.max(0, agg._sum.amount ?? 0);
    history = await prisma.pointLog.findMany({
      where: { userId: session.user.id, createdAt: { gte: yearsAgo(POINT_HISTORY_YEARS) } },
      orderBy: { createdAt: "desc" },
      take: 500, // 최대 2년치(페이지네이션으로 탐색)
      select: { id: true, amount: true, reason: true, status: true, createdAt: true },
    });
  } catch {
    // DB 미연결
  }

  // 활동 배지 + 내 활동 타임라인 (가게/세일/리뷰)
  let activityScore = 0;
  const timeline: TimelineItem[] = [];
  try {
    const [storeCount, saleCount, favCount, myStores, mySales] = await Promise.all([
      prisma.store.count({ where: { createdById: session.user.id } }),
      prisma.sale.count({ where: { createdById: session.user.id } }),
      prisma.favorite.count({ where: { userId: session.user.id } }),
      prisma.store.findMany({
        where: { createdById: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.sale.findMany({
        where: { createdById: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, title: true, createdAt: true, store: { select: { id: true, name: true } } },
      }),
    ]);
    activityScore = storeCount * 4 + saleCount * 2 + myReviews.length * 2 + favCount * 1;
    for (const s of myStores)
      timeline.push({ id: `st-${s.id}`, icon: "🏪", text: `${s.name} 등록`, href: `/s/${s.id}`, date: s.createdAt });
    for (const s of mySales)
      timeline.push({
        id: `sl-${s.id}`,
        icon: "🔥",
        text: `${s.store.name} — ${s.title} 세일 제보`,
        href: `/s/${s.store.id}`,
        date: s.createdAt,
      });
    for (const r of myReviews)
      timeline.push({
        id: `rv-${r.id}`,
        icon: "✍️",
        text: `${r.store.name} 리뷰 작성`,
        href: `/s/${r.storeId}`,
        date: r.createdAt,
      });
    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch {
    // DB 미연결
  }
  const badge = activityBadge(activityScore);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-5 p-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-400">
            ← 지도로
          </Link>
          <div className="flex gap-3 text-sm">
            <Link href="/notifications" className="text-gray-500 hover:text-gray-800">🔔 알림</Link>
            <Link href="/settings" className="text-gray-500 hover:text-gray-800">⚙️ 설정</Link>
          </div>
        </div>

        <section>
          <h1 className="text-xl font-bold">마이페이지</h1>
          <div className="mt-3 rounded-xl border border-gray-200 p-4">
            <ProfileAvatarEditor currentUrl={profileImg} nickname={nickname} />
            <form action={updateNickname} className="mt-3 flex gap-2">
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
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                {badge.emoji} {badge.label}
              </span>
              <span className="text-xs text-gray-400">활동점수 {activityScore}</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              적립 포인트{" "}
              <span className="font-semibold text-gray-800">{balance}P</span>
            </p>
            <Link
              href="/shop"
              className="mt-2 inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white"
            >
              🎁 포인트샵 (기프티콘 교환)
            </Link>
          </div>
        </section>

        {/* 기프티콘 수령 연락처 (SMS 인증) */}
        <section id="contact">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">기프티콘 수령 연락처</h2>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="mb-2 text-xs text-gray-400">
              포인트로 기프티콘을 교환하면 이 연락처(문자)로 보내드려요. 추천 보상은 <b>SMS 인증된 연락처</b>에만 지급돼요.
            </p>
            <ContactVerifyForm current={contactPhone} />
          </div>
        </section>

        {/* 내가 쓴 리뷰 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">내가 쓴 리뷰 ({myReviews.length})</h2>
          {myReviews.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
              아직 작성한 리뷰가 없어요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {myReviews.map((r) => (
                <MyReviewItem
                  key={r.id}
                  review={{
                    id: r.id,
                    storeId: r.storeId,
                    storeName: r.store.name,
                    rating: r.rating,
                    content: r.content,
                    tags: r.tags,
                    products: r.productIds
                      .filter((pid) => productNameMap.has(pid))
                      .map((pid) => ({ id: pid, name: productNameMap.get(pid) as string })),
                    photoUrls: r.photoUrls,
                    receiptVerified: Boolean(r.receiptUrl),
                    scored: r.scored,
                    createdAt: r.createdAt.toISOString(),
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        {/* 내 활동 타임라인 */}
        {timeline.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">내 활동</h2>
            <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200">
              {timeline.slice(0, 12).map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50">
                    <span aria-hidden>{t.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{t.text}</span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {reviewDateLabel(t.date.toISOString())}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 기프티콘 교환 내역 */}
        {redemptions.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">기프티콘 교환 내역</h2>
            <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200">
              {redemptions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">🎁 {r.itemName}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString("ko-KR")} ·{" "}
                      {REDEMPTION_LABEL[r.status] ?? r.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-red-500">-{r.points}P</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">포인트 내역</h2>
          <PointHistory
            items={history.map((h) => ({
              id: h.id,
              amount: h.amount,
              reason: h.reason,
              date: new Date(h.createdAt).toLocaleDateString("ko-KR"),
            }))}
          />
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

        <Link
          href="/favorites"
          className="flex items-center justify-between rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50"
        >
          <span className="font-medium">♥ 즐겨찾기</span>
          <span className="text-sm text-gray-400">보기 →</span>
        </Link>

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
