import Link from "next/link";

export const metadata = { title: "개인정보처리방침 — 동네 세일 지도" };

/** 개인정보처리방침 (스펙 1-1 필수, 6장 수집 최소화 반영). 운영 전 법률 검토 필요. */
export default function PrivacyPage() {
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl space-y-4 p-5 text-sm leading-relaxed text-gray-700">
        <Link href="/" className="text-gray-400">
          ← 지도로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">개인정보처리방침</h1>
        <p className="text-xs text-gray-400">
          본 문서는 MVP 단계의 초안이며, 정식 운영 전 법률 검토가 필요합니다.
        </p>

        <section>
          <h2 className="font-semibold">1. 수집하는 개인정보</h2>
          <p>
            소셜 로그인(네이버) 시 제공되는 <b>닉네임, 프로필 이미지, 소셜 식별자</b>만
            수집합니다. 서비스 제공에 필요한 최소한의 정보만 수집하며,
            <b> 단말의 위치정보(GPS)는 수집하지 않습니다.</b> 지도 이동은 사용자가 입력한
            검색어를 좌표로 변환(지오코딩)하는 방식으로만 동작합니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">2. 이용 목적</h2>
          <p>회원 식별, 제보·리뷰 작성자 표시, 부정이용(어뷰징) 방지에 한해 이용합니다.</p>
        </section>

        <section>
          <h2 className="font-semibold">3. 보유 및 파기</h2>
          <p>
            회원 탈퇴 시 개인정보(닉네임·프로필·소셜 식별자)는 <b>즉시 파기</b>합니다. 작성한
            가게·세일 정보는 ‘탈퇴한 사용자’로 익명화되어 커뮤니티 데이터로 유지되며, 리뷰·즐겨찾기·
            포인트 기록은 함께 삭제됩니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">4. 제3자 제공 및 처리위탁</h2>
          <p>
            지도/검색은 카카오, 인증은 네이버, 데이터·이미지 저장은 Supabase 인프라를
            이용합니다. 위 목적 외 제3자에게 개인정보를 제공하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">5. 이용자 권리</h2>
          <p>
            언제든지 본인 정보 열람·삭제를 요청할 수 있으며, 회원 탈퇴는{" "}
            <Link href="/account" className="text-blue-600">
              내 계정
            </Link>{" "}
            에서 가능합니다.
          </p>
        </section>
      </article>
    </div>
  );
}
