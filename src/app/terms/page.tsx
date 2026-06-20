import Link from "next/link";

export const metadata = { title: "이용약관 — 동네 세일 지도" };

/** 이용약관 (스펙 1-1 필수). MVP 초안 — 정식 운영 전 법률 검토 필요. */
export default function TermsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl space-y-4 p-5 text-sm leading-relaxed text-ink-2">
        <Link href="/" className="text-ink-3">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-ink">이용약관</h1>
        <p className="text-xs text-ink-3">
          본 약관은 MVP 단계의 초안이며, 정식 운영 전 법률 검토가 필요합니다.
        </p>

        <section>
          <h2 className="font-semibold">제1조 (목적)</h2>
          <p>
            본 약관은 ‘동네 세일 지도’(이하 “서비스”)가 제공하는 하이퍼로컬 세일 정보 공유
            기능의 이용 조건을 정합니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">제2조 (이용자 제보 콘텐츠)</h2>
          <p>
            이용자는 가게·세일·리뷰 정보를 제보할 수 있으며, 제보 내용의 사실성에 대한 책임은
            작성자에게 있습니다. 허위·과장·타인 권리 침해 콘텐츠는 신고 대상이 됩니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">제3조 (신고와 자동 숨김)</h2>
          <p>
            특정 콘텐츠에 신고가 일정 건수 이상 누적되면 <b>자동으로 숨김 처리</b>된 뒤 운영자가
            사후 검토합니다. 사전 전수 검열은 하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">제4조 (포인트)</h2>
          <p>
            제보 시 적립되는 포인트는 <b>적립 기록(표시용)</b>일 뿐이며, 현 단계에서 실제 지급·
            현금화·교환은 제공되지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">제5조 (금지 행위)</h2>
          <p>
            단시간 대량 제보 등 부정이용(어뷰징)은 제한될 수 있으며, 위반 시 이용이 정지될 수
            있습니다.
          </p>
        </section>
      </article>
    </div>
  );
}
