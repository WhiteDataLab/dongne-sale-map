import Link from "next/link";

export const metadata = { title: "운영정책 · 커뮤니티 가이드 — 동네 세일 지도" };

/** 운영정책 / 커뮤니티 가이드 (P1). 신고·자동숨김 기준 공개로 신뢰 확보. */
export default function PolicyPage() {
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl space-y-4 p-5 text-sm leading-relaxed text-ink-2">
        <Link href="/" className="text-ink-3">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-ink">운영정책 · 커뮤니티 가이드</h1>
        <p className="text-xs text-ink-3">
          이웃 모두가 믿고 쓰는 동네 지도를 위한 약속이에요.
        </p>

        <section>
          <h2 className="font-semibold">1. 우리가 지향하는 것</h2>
          <p>
            ‘동네 세일 지도’는 이웃이 직접 올리는 <b>실시간 세일·가게 정보</b>로 굴러가요. 사전
            전수 검열 대신, 이웃들의 신고와 자동 숨김으로 건강하게 관리해요.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">2. 콘텐츠 작성 기준</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>실제 진행 중인 세일·정확한 가게 정보만 올려 주세요.</li>
            <li>리뷰는 <b>실제 구매·이용 경험</b>을 바탕으로, 구매한 메뉴와 함께 남겨 주세요.</li>
            <li>허위·과장·광고성·욕설·차별·타인 권리 침해 콘텐츠는 금지돼요.</li>
            <li>같은 가게에 같은 날 여러 번 리뷰를 쓰면 포인트·별점은 반영되지 않아요.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">3. 신고와 자동 숨김</h2>
          <p>
            한 콘텐츠(가게·세일·리뷰·메뉴)에 <b>서로 다른 이용자 3명</b> 이상의 신고가 쌓이면
            <b> 자동으로 숨김</b> 처리된 뒤 운영자가 사후 검토해요. 동일인의 중복 신고는 1건으로만
            집계돼요.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">4. 포인트 어뷰징 방지</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>단시간 대량 제보, 가짜 사진/URL, 중복 제보는 제한·차단돼요.</li>
            <li>콘텐츠가 숨김·삭제되면 해당 적립 포인트는 회수돼요.</li>
            <li>위반이 반복되면 계정 이용이 <b>정지</b>될 수 있어요.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">5. 휴업·폐업 제보</h2>
          <p>
            현장 사진과 함께 ‘오늘 휴업/폐업’을 제보하면 다른 이웃에게 경고로 표시돼요. 확정
            정보가 아닌 <b>이웃 제보</b>이며, 누적 신고/검토로 보정돼요.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">6. 관련 문서</h2>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/terms" className="text-brand">이용약관</Link>
            <Link href="/privacy" className="text-brand">개인정보처리방침</Link>
            <Link href="/location-terms" className="text-brand">위치기반서비스 이용약관</Link>
            <Link href="/refund" className="text-brand">포인트·기프티콘 교환/환불 정책</Link>
          </p>
        </section>
      </article>
    </div>
  );
}
