import { prisma } from "@/lib/prisma";
import { createSignedDocUrl } from "@/lib/supabaseStorage";
import { approveMerchant, rejectMerchant } from "../actions";

/** 사장님 인증 심사 (Phase 7a): 업로드된 사업자등록증을 서명 URL로 확인 후 승인/반려. */
export default async function AdminMerchants() {
  let rows: {
    id: string;
    docPath: string;
    createdAt: Date;
    user: { nickname: string };
    store: { name: string; address: string };
  }[] = [];
  try {
    rows = await prisma.merchantVerification.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        docPath: true,
        createdAt: true,
        user: { select: { nickname: true } },
        store: { select: { name: true, address: true } },
      },
    });
  } catch {
    // DB 미연결
  }

  // 비공개 문서 → 단기 서명 URL (관리자만)
  const signed = await Promise.all(rows.map((r) => createSignedDocUrl(r.docPath)));

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-3">대기 중인 사장님 인증 신청이 없어요.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.id} className="rounded-xl border border-line p-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">{r.store.name}</span>
            <span className="text-xs text-ink-3">신청자 {r.user.nickname}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-3">{r.store.address}</p>

          {/* 사업자등록증 (서명 URL, 새 탭에서 확인) */}
          <div className="mt-2">
            {signed[i] ? (
              <a
                href={signed[i] as string}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-line-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signed[i] as string} alt="사업자등록증" className="max-h-64 w-full object-contain bg-surface-2" />
              </a>
            ) : (
              <p className="text-xs text-ink-3">이미지를 불러올 수 없어요(스토리지 미설정/만료).</p>
            )}
          </div>

          <div className="mt-2 flex gap-2">
            <form action={approveMerchant}>
              <input type="hidden" name="id" value={r.id} />
              <button className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 active:bg-green-800">
                승인 (사장님 권한 부여)
              </button>
            </form>
            <form action={rejectMerchant}>
              <input type="hidden" name="id" value={r.id} />
              <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 active:bg-gray-200">
                반려
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
