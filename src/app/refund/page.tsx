import Link from "next/link";

export const metadata = { title: "포인트·기프티콘 교환/환불 정책 — 동네 세일 지도" };

/** 포인트·기프티콘 교환/환불 정책 (P1). 포인트샵(전자상거래성) 분쟁 대비. MVP 초안 — 법률 검토 필요. */
export default function RefundPage() {
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl space-y-4 p-5 text-sm leading-relaxed text-gray-700">
        <Link href="/" className="text-gray-400">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">포인트 · 기프티콘 교환/환불 정책</h1>
        <p className="text-xs text-gray-400">
          본 정책은 MVP 단계의 초안이며, 정식 운영 전 법률 검토가 필요합니다.
        </p>

        <section>
          <h2 className="font-semibold">1. 포인트의 성격</h2>
          <p>
            포인트는 가게·세일·리뷰 제보 등 활동에 대한 <b>적립 보상(서비스 내 사이버머니)</b>이며,
            현금이 아니고 현금으로 환급되지 않아요. 적립 후 <b>5년</b>이 지난 포인트는 소멸돼요.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">2. 기프티콘 교환</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>포인트샵에서 상품별 표기된 포인트로 기프티콘 교환을 신청할 수 있어요.</li>
            <li>교환 신청 시 포인트가 차감되고, 운영자가 등록된 <b>인증 연락처(문자)</b>로 발송해요.</li>
            <li>발송은 외부 전문샵을 통해 수동 처리되며, 영업일 기준 수일이 걸릴 수 있어요.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">3. 취소·환불(포인트 환원)</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>발송 전</b>(발송 대기) 상태에서 취소되면 차감된 포인트가 전액 환원돼요.</li>
            <li><b>발송 완료</b> 후에는 기프티콘 특성상 교환·환불이 제한돼요(미사용·유효기간 내 불량 등 예외).</li>
            <li>연락처 오류 등으로 발송이 불가하면 운영자가 취소 처리하고 포인트를 환원해요.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">4. 포인트 회수</h2>
          <p>
            제보 콘텐츠가 신고 누적·운영자 판단으로 숨김·삭제되거나 어뷰징이 확인되면 해당 적립
            포인트는 회수돼요. 회수로 잔액이 부족해질 경우 교환이 제한될 수 있어요.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">5. 문의</h2>
          <p>
            교환/환불 관련 문의는 <Link href="/support" className="text-blue-600">고객센터</Link>로
            접수해 주세요.
          </p>
        </section>
      </article>
    </div>
  );
}
