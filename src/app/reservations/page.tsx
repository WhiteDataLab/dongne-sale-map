import Link from "next/link";
import { auth, signIn } from "@/auth";
import { getMyReservations } from "@/lib/reservations";
import { MyReservationList } from "@/components/MyReservationList";

export const metadata = { title: "내 예약 — 동네 세일 지도" };
export const dynamic = "force-dynamic";

/** M7(L2) — 내 떨이 픽업 예약함. 진행중 예약은 매장에서 픽업코드로 수령. */
export default async function MyReservationsPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="h-full overflow-y-auto p-6 text-center text-sm text-gray-500">
        <p className="mt-10">로그인이 필요해요.</p>
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: "/reservations" });
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

  let reservations: Awaited<ReturnType<typeof getMyReservations>> = [];
  try {
    reservations = await getMyReservations(session.user.id);
  } catch {
    // DB 미연결
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-3 p-5">
        <Link href="/" className="text-sm text-gray-400">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold">
          내 예약 {reservations.length > 0 && `(${reservations.length})`}
        </h1>
        <p className="text-xs text-gray-400">
          예약은 매장에서 <b>현장결제</b>로 픽업해요. 픽업 시 아래 <b>예약번호</b>를 보여주세요.
        </p>
        <MyReservationList initial={reservations} />
      </div>
    </div>
  );
}
