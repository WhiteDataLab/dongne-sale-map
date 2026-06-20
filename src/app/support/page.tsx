import Link from "next/link";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SupportForm } from "@/components/SupportForm";

/** 고객센터: 1:1 문의 작성 + 내 문의/답변 확인. */
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-ink-3">
        <p className="mt-10">고객센터 문의는 로그인 후 이용할 수 있어요.</p>
        <form
          action={async () => {
            "use server";
            await signIn(undefined, { redirectTo: "/support" });
          }}
        >
          <button className="mt-3 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white">로그인하기</button>
        </form>
        <Link href="/" className="mt-4 inline-block text-brand">← 지도로</Link>
      </div>
    );
  }

  let inquiries: {
    id: string;
    title: string;
    content: string;
    status: string;
    attachmentUrl: string | null;
    answer: string | null;
    answeredAt: Date | null;
    createdAt: Date;
  }[] = [];
  try {
    inquiries = await prisma.inquiry.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        attachmentUrl: true,
        answer: true,
        answeredAt: true,
        createdAt: true,
      },
    });
  } catch {
    // DB 미연결
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-2">
      <div className="mx-auto flex max-w-md flex-col gap-4 p-5">
        <Link href="/" className="text-sm text-ink-3">← 지도로</Link>
        <h1 className="text-xl font-bold">고객센터</h1>

        <SupportForm defaultNickname={session.user.name ?? "이웃"} />

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-2">내 문의 내역 ({inquiries.length})</h2>
          {inquiries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-3">
              아직 문의 내역이 없어요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {inquiries.map((q) => (
                <li key={q.id} className="overflow-hidden rounded-xl border border-line bg-white">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{q.title}</span>
                      <span
                        className={[
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          q.status === "answered" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {q.status === "answered" ? "답변완료" : "문의중"}
                      </span>
                    </summary>
                    <div className="border-t border-line-2 px-3 py-3">
                      <p className="text-xs text-ink-3">{new Date(q.createdAt).toLocaleString("ko-KR")}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{q.content}</p>
                      {q.attachmentUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={q.attachmentUrl} alt="" className="mt-2 w-40 rounded-lg object-cover" />
                      )}
                      {q.answer ? (
                        <div className="mt-3 rounded-lg bg-brand-wash p-3">
                          <p className="text-xs font-semibold text-brand-ink">💬 고객센터 답변</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{q.answer}</p>
                          {q.answeredAt && (
                            <p className="mt-1 text-xs text-ink-3">{new Date(q.answeredAt).toLocaleString("ko-KR")}</p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-amber-600">아직 답변 대기 중이에요.</p>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
