import Link from "next/link";

export const metadata = { title: "위치기반서비스 이용약관 — 동네 세일 지도" };

/** 위치기반서비스 이용약관 (P0). 지도/지오코딩 사용 서비스 표준. MVP 초안 — 정식 운영 전 법률 검토 필요. */
export default function LocationTermsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl space-y-4 p-5 text-sm leading-relaxed text-ink-2">
        <Link href="/" className="text-ink-3">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-ink">위치기반서비스 이용약관</h1>
        <p className="text-xs text-ink-3">
          본 약관은 MVP 단계의 초안이며, 정식 운영 전 법률 검토가 필요합니다.
        </p>

        <section>
          <h2 className="font-semibold">제1조 (목적)</h2>
          <p>
            본 약관은 ‘동네 세일 지도’(이하 “서비스”)가 제공하는 지도 기반 가게·세일 정보 조회
            등 위치기반서비스의 이용 조건과 절차를 정합니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">제2조 (개인위치정보의 미수집)</h2>
          <p>
            서비스는 이용자의 <b>GPS 등 개인위치정보를 서버에 수집·저장하지 않습니다.</b> 지도
            이동은 이용자가 입력한 검색어를 좌표로 변환(지오코딩)하는 방식으로만 동작합니다.
            ‘현재 위치’ 기능 사용 시 브라우저가 제공하는 위치는 지도 화면 이동에만 일시적으로
            쓰이고 저장되지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">제3조 (가게 위치정보)</h2>
          <p>
            지도에 표시되는 가게의 위치(좌표·주소)는 이용자 또는 사장님이 직접 등록한 정보이며,
            실제와 다를 수 있습니다. 잘못된 정보는 신고·정정 요청으로 보완됩니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">제4조 (지도 데이터 제공자)</h2>
          <p>
            지도 표시 및 장소 검색은 카카오 지도/로컬 API 등 외부 제공자의 데이터를 이용하며,
            해당 제공자의 약관이 함께 적용됩니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">제5조 (면책)</h2>
          <p>
            위치·세일 정보의 오류나 이를 신뢰해 발생한 손해에 대해 서비스는 고의 또는 중대한
            과실이 없는 한 책임을 지지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">제6조 (문의)</h2>
          <p>
            위치기반서비스 관련 문의는 <Link href="/support" className="text-brand">고객센터</Link>로
            접수해 주세요.
          </p>
        </section>
      </article>
    </div>
  );
}
