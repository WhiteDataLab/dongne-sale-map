/**
 * 리뷰 자동 모더레이션(경량, 무료·결정적).
 *
 * 욕설·음란·광고/스팸 패턴을 키워드/정규식으로 1차 감지한다. 외부 API 없이 요청 경로에서 즉시 판정.
 * 설계 철학: **삭제가 아니라 임시 보관(held)** 이므로 다소 적극적으로 잡아도 안전하다(오인 시 관리자 복원).
 * 정밀 판정·맥락 이해는 관리자 검토(임시 보관함)에서 보강한다.
 */
export type ModerationResult = {
  flagged: boolean;
  /** 감지 카테고리 라벨(보관 사유 표시용). */
  reason: string | null;
};

/** 우회(ㅅㅂ, 시1발 등) 차단용: 공백·특수문자·숫자치환 일부를 정규화. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s._\-*~^]/g, "") // 글자 사이 구분자 제거
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/@/g, "a");
}

// 욕설/비속어(정규화 후 매칭). 과도한 일반어 오탐을 피하려 강한 표현 위주.
const PROFANITY = [
  "씨발", "시발", "씨바", "시바", "씌발", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "지랄", "ㅈㄹ",
  "좆", "존나", "졸라", "개새끼", "개색기", "새끼", "개놈", "쌍놈", "닥쳐", "꺼져", "엿먹",
  "fuck", "shit", "bitch", "썅", "느금마", "니애미", "creep",
];

// 음란/성인.
const OBSCENE = [
  "섹스", "야동", "자위", "성인용품", "조건만남", "오랄", "포르노", "porn", "ㅅㅅ",
  "19금", "애무", "음란", "변태", "젖꼭지", "성기", "콜걸", "출장만남",
];

// 광고/스팸: 외부 유인(URL·연락처·메신저 ID·도박/대출/홍보).
const SPAM_WORDS = [
  "카톡", "카카오톡", "텔레그램", "텔레", "라인아이디", "디엠", "dm문의", "open.kakao",
  "토토", "카지노", "바카라", "베팅", "배팅", "슬롯", "먹튀", "대출", "전화주세요",
  "광고문의", "홍보문의", "수익보장", "재택알바", "고수익", "부업문의", "코인추천",
  "방문하세요", "클릭", "이벤트당첨", "무료체험권",
];

const URL_RE = /(https?:\/\/|www\.|\b[\w-]+\.(?:com|net|kr|co|io|me|gg|shop|xyz|link)\b)/i;
const PHONE_RE = /01[016-9][-.\s]?\d{3,4}[-.\s]?\d{4}/; // 휴대폰 번호 노출(외부 유인)
const KAKAO_ID_RE = /(카톡|카카오톡|텔레|라인)\s*(아이디|id)?\s*[:：]?\s*[a-z0-9_]{3,}/i;

function includesAny(haystack: string, words: string[]): boolean {
  return words.some((w) => haystack.includes(w));
}

/**
 * 리뷰 텍스트(태그 + 본문 합)를 검사. 부적절하면 flagged + 사유.
 * 우선순위: 음란 > 욕설 > 광고/스팸. (사유 라벨은 하나만)
 */
export function screenReview(rawText: string): ModerationResult {
  const raw = (rawText ?? "").trim();
  if (!raw) return { flagged: false, reason: null };
  const norm = normalize(raw);

  if (includesAny(norm, OBSCENE.map(normalize))) {
    return { flagged: true, reason: "음란성 표현" };
  }
  if (includesAny(norm, PROFANITY.map(normalize))) {
    return { flagged: true, reason: "욕설/비속어" };
  }
  if (
    URL_RE.test(raw) ||
    PHONE_RE.test(raw) ||
    KAKAO_ID_RE.test(raw) ||
    includesAny(norm, SPAM_WORDS.map(normalize))
  ) {
    return { flagged: true, reason: "광고/스팸" };
  }
  return { flagged: false, reason: null };
}
