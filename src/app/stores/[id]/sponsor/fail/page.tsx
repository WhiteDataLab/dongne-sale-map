import Link from "next/link";

/** M2 — 토스 카드 인증 실패/취소 콜백. */
export const dynamic = "force-dynamic";

export default async function SponsorFailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string; message?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const message = typeof sp.message === "string" ? sp.message : "결제가 취소됐어요.";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md p-5 text-center">
        <p className="mt-10 text-2xl">🙇</p>
        <p className="mt-2 font-semibold">카드 등록이 완료되지 않았어요</p>
        <p className="mt-1 text-xs text-gray-400">{message}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href={`/stores/${id}/sponsor`} className="text-blue-600">다시 시도</Link>
          <Link href="/" className="text-gray-400">지도로</Link>
        </div>
      </div>
    </div>
  );
}
