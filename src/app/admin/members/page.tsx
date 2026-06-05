import { prisma } from "@/lib/prisma";
import { POINT_EXPIRY_YEARS, yearsAgo } from "@/lib/points";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { lockUser, unlockUser, forceDeleteUser } from "../actions";

/** 회원 정보 관리 (관리자): 가입일·계정·닉네임·적립포인트 + 계정잠금/강제탈퇴. */
export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = {
  kakao: "카카오",
  naver: "네이버",
  phone: "전화번호",
};

type Member = {
  id: string;
  nickname: string;
  createdAt: Date;
  provider: string | null;
  phone: string | null;
  role: string;
  status: string;
};

export default async function AdminMembers() {
  let members: Member[] = [];
  const pointsByUser = new Map<string, number>();
  let dbError = false;

  try {
    members = await prisma.user.findMany({
      where: { providerId: { not: "deleted-user" } }, // 고스트 sentinel 제외
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        nickname: true,
        createdAt: true,
        provider: true,
        phone: true,
        role: true,
        status: true,
      },
    });
    // 적립포인트 잔액 = PointLog 합계(소멸 기간 이내), 회원별 집계
    const sums = await prisma.pointLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: yearsAgo(POINT_EXPIRY_YEARS) } },
      _sum: { amount: true },
    });
    for (const s of sums) pointsByUser.set(s.userId, s._sum.amount ?? 0);
  } catch {
    dbError = true;
  }

  if (dbError) {
    return <p className="py-10 text-center text-sm text-gray-400">회원 정보를 불러오지 못했어요 (DB 연결 확인).</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">회원 정보</h2>
        <span className="text-xs text-gray-400">최근 가입순 · 최대 300명</span>
      </div>

      {members.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">회원이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((u) => {
            const account =
              u.provider === "phone" && u.phone
                ? u.phone
                : PROVIDER_LABEL[u.provider ?? ""] ?? "기타";
            const locked = u.status === "banned";
            return (
              <li key={u.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{u.nickname}</span>
                      {u.role === "admin" && (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-medium text-purple-700">관리자</span>
                      )}
                      {u.role === "merchant" && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">사장님</span>
                      )}
                      {locked && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-600">잠금</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {PROVIDER_LABEL[u.provider ?? ""] ?? "기타"} · {account}
                    </p>
                    <p className="text-xs text-gray-400">
                      가입 {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">적립포인트</p>
                    <p className="font-bold tabular-nums">{(pointsByUser.get(u.id) ?? 0).toLocaleString("ko-KR")}P</p>
                  </div>
                </div>

                {u.role !== "admin" && (
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-50 pt-2">
                    {locked ? (
                      <form action={unlockUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                          잠금 해제
                        </button>
                      </form>
                    ) : (
                      <form action={lockUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                          계정 잠금
                        </button>
                      </form>
                    )}
                    <form action={forceDeleteUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <ConfirmSubmit
                        message={`'${u.nickname}' 회원을 강제 탈퇴할까요?\n계정과 개인정보가 즉시 삭제되며 되돌릴 수 없어요.`}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                      >
                        강제 탈퇴
                      </ConfirmSubmit>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-gray-400">
        · 적립포인트 = 최근 {POINT_EXPIRY_YEARS}년 내 적립 합계. · 관리자 계정은 잠금/탈퇴할 수 없어요. · 강제 탈퇴 시 콘텐츠는 익명화되고 개인정보는 파기돼요.
      </p>
    </div>
  );
}
