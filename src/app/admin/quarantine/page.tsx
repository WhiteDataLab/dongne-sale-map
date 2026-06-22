import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { releaseHeldReview, deleteHeldReview } from "../actions";

/**
 * 임시 보관함 — 자동 모더레이션(욕설·음란·광고)으로 격리된 리뷰.
 * 시스템이 삭제하지 않고 비공개 보류만 했으므로, 관리자가 검토 후 복원(노출)/삭제를 결정한다.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "임시 보관함 — 관리" };

export default async function AdminQuarantinePage() {
  const session = await getAdminSession();
  if (!session) return null;

  let held: {
    id: string;
    content: string;
    tags: string[];
    rating: number;
    heldReason: string | null;
    heldAt: Date | null;
    photoUrls: string[];
    user: { nickname: string };
    store: { name: string };
  }[] = [];
  let dbError = false;
  try {
    held = await prisma.review.findMany({
      where: { held: true },
      orderBy: { heldAt: "desc" },
      take: 200,
      select: {
        id: true,
        content: true,
        tags: true,
        rating: true,
        heldReason: true,
        heldAt: true,
        photoUrls: true,
        user: { select: { nickname: true } },
        store: { select: { name: true } },
      },
    });
  } catch {
    dbError = true;
  }

  if (dbError) {
    return <p className="py-10 text-center text-sm text-ink-3">임시 보관함을 불러오지 못했어요 (DB 연결 확인).</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">임시 보관함</h2>
        <span className="text-xs text-ink-3">자동 격리 리뷰 {held.length}건</span>
      </div>
      <p className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        욕설·음란·광고로 <b>자동 감지</b>돼 비공개 보류된 리뷰예요. 시스템이 삭제하진 않으니, 내용을
        확인하고 <b>복원</b>(정상이면 다시 노출 + 적립 반영) 또는 <b>삭제</b>(스팸 확정)를 선택하세요.
      </p>

      {held.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-3">보관 중인 리뷰가 없어요. 👍</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {held.map((r) => (
            <li key={r.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-600">
                  {r.heldReason ?? "보관"}
                </span>
                <span className="text-sm font-semibold">{r.store.name}</span>
                <span className="text-xs text-ink-3">· {r.user.nickname}</span>
                <span className="text-xs text-amber-500">{"★".repeat(r.rating)}</span>
                {r.heldAt && (
                  <span className="ml-auto text-[11px] text-ink-3">
                    {new Date(r.heldAt).toLocaleString("ko-KR")}
                  </span>
                )}
              </div>

              {r.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-2">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {r.content && <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-ink">{r.content}</p>}
              {r.photoUrls.length > 0 && (
                <p className="mt-1 text-[11px] text-ink-3">📷 사진 {r.photoUrls.length}장</p>
              )}

              <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-50 pt-2">
                <form action={releaseHeldReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-surface-2">
                    복원 (노출)
                  </button>
                </form>
                <form action={deleteHeldReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <ConfirmSubmit
                    message={"이 리뷰를 삭제할까요?\n작성자의 적립 포인트도 함께 회수되며 되돌릴 수 없어요."}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                  >
                    삭제 (스팸 확정)
                  </ConfirmSubmit>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
