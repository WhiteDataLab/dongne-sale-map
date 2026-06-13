/**
 * 서버 전용 시크릿 조회.
 *
 * AUTH_SECRET 은 세션 서명뿐 아니라 전화번호 인증코드·연락처 해시의 솔트로도 쓰인다.
 * 과거엔 미설정 시 `"salt"` 로 폴백했는데, 이는 **예측 가능한 솔트**라 해시를
 * 역산·레인보우테이블 공격에 노출시킨다. 운영에선 항상 설정되어야 하므로,
 * 미설정이면 폴백 대신 **즉시 throw** 한다(요청 시점에만 실행 → 빌드는 무손상).
 */
export function requireAuthSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error(
      "AUTH_SECRET 미설정 — 보안상 폴백 솔트를 쓰지 않습니다. 환경변수를 설정해 주세요.",
    );
  }
  return s;
}
