import Link from "next/link";

export const metadata = { title: "자주 묻는 질문 — 동네 세일 지도" };

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "내 위치 정보가 저장되나요?",
    a: "아니요. GPS 등 위치정보는 저장하지 않아요. 지도는 검색어를 좌표로 바꾸는 방식으로만 움직여요.",
  },
  {
    q: "포인트는 어떻게 모으나요?",
    a: "가게 등록·세일 제보·리뷰 작성·출석체크·친구 초대 등 활동으로 모아요. 모은 포인트는 포인트샵에서 기프티콘으로 교환할 수 있어요.",
  },
  {
    q: "리뷰는 어떻게 쓰나요?",
    a: "가게 상세 → 리뷰 탭에서 구매한 메뉴를 1개 이상 선택하고 별점·태그·사진으로 남겨요. 첫 리뷰는 글만 써도 포인트를 받고, 두 번째부터는 사진이 있어야 받아요.",
  },
  {
    q: "같은 가게에 리뷰를 또 쓸 수 있나요?",
    a: "쓸 수 있어요. 다만 같은 날 같은 가게에 다시 쓰면 별점·포인트는 반영되지 않아요(악용 방지). 기존 리뷰를 지우면 다시 반영돼요.",
  },
  {
    q: "잘못된 가게/세일 정보를 봤어요.",
    a: "각 콘텐츠의 신고(🚩) 버튼으로 알려주세요. 서로 다른 이용자 3명 이상 신고가 쌓이면 자동으로 숨겨진 뒤 검토돼요.",
  },
  {
    q: "사장님인데 우리 가게를 직접 관리하고 싶어요.",
    a: "가게 상세 → 공지 탭의 ‘사장님 인증’에서 사업자등록증을 올리면 관리자 승인 후 메뉴·배너·공지를 직접 관리할 수 있어요.",
  },
  {
    q: "기프티콘은 언제 와요?",
    a: "교환 신청 후 운영자가 인증된 연락처로 수동 발송해요. 영업일 기준 수일이 걸릴 수 있어요. 자세한 내용은 교환/환불 정책을 참고해 주세요.",
  },
];

/** FAQ / 도움말 (P2). */
export default function FaqPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-5">
        <Link href="/" className="text-sm text-gray-400">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">자주 묻는 질문</h1>

        <ul className="flex flex-col gap-2">
          {FAQS.map((f) => (
            <li key={f.q} className="rounded-xl border border-gray-200">
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 text-sm font-medium text-gray-800">
                  <span>Q. {f.q}</span>
                  <span className="text-gray-300 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-gray-600">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>

        <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
          더 궁금한 점이 있으면 <Link href="/support" className="font-medium text-blue-600">고객센터</Link>로
          문의해 주세요.
        </p>
      </div>
    </div>
  );
}
