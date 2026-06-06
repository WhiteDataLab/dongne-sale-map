import { prisma } from "@/lib/prisma";
import { answerInquiry } from "../actions";

/** 고객센터 문의 관리 (관리자): 문의 확인 + 답변 작성. */
export const dynamic = "force-dynamic";

export default async function AdminInquiries() {
  let rows: {
    id: string;
    nickname: string;
    email: string;
    title: string;
    content: string;
    attachmentUrl: string | null;
    status: string;
    answer: string | null;
    createdAt: Date;
  }[] = [];
  let dbError = false;
  try {
    rows = await prisma.inquiry.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        nickname: true,
        email: true,
        title: true,
        content: true,
        attachmentUrl: true,
        status: true,
        answer: true,
        createdAt: true,
      },
    });
  } catch {
    dbError = true;
  }

  if (dbError) return <p className="py-10 text-center text-sm text-gray-400">문의를 불러오지 못했어요.</p>;

  const open = rows.filter((r) => r.status === "open").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">고객센터 문의</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-700">미답변 {open}</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">문의가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((q) => (
            <li key={q.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{q.title}</p>
                  <p className="text-xs text-gray-500">
                    {q.nickname} · {q.email}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(q.createdAt).toLocaleString("ko-KR")}</p>
                </div>
                <span
                  className={[
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    q.status === "answered" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                  ].join(" ")}
                >
                  {q.status === "answered" ? "답변완료" : "문의중"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{q.content}</p>
              {q.attachmentUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.attachmentUrl} alt="" className="mt-2 w-40 rounded-lg object-cover" />
              )}

              {q.answer && (
                <div className="mt-2 rounded-lg bg-blue-50 p-2.5">
                  <p className="text-xs font-semibold text-blue-700">💬 내 답변</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{q.answer}</p>
                </div>
              )}

              <form action={answerInquiry} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="id" value={q.id} />
                <textarea
                  name="answer"
                  rows={2}
                  defaultValue={q.answer ?? ""}
                  placeholder="답변을 작성하세요."
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button className="self-end rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                  {q.status === "answered" ? "답변 수정" : "답변 등록"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
