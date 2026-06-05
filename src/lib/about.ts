/**
 * 서비스 소개(/about) 페이지 콘텐츠 모델.
 * SiteConfig(key="about_content")에 JSON 문자열로 저장하며, 관리자가 편집한다.
 * 저장값이 없으면 DEFAULT_ABOUT 로 폴백한다(코드의 기본 카피).
 */

export type AboutBlock = {
  id: string;
  title: string;
  desc: string;
  emoji: string; // 이미지가 없을 때 보여줄 기본 이모지
  gradient: string; // 이미지가 없을 때 배경 그라데이션 (tailwind 'from-x to-y')
  imageUrl?: string; // 업로드 이미지(있으면 이모지/그라데이션 대신 표시)
  dark?: boolean; // 어두운 배경 섹션
};

export type AboutContent = {
  hero: { eyebrow: string; title: string; subtitle: string; cta: string };
  blocks: AboutBlock[];
  closing: { title: string; cta: string; footer: string };
};

export const DEFAULT_ABOUT: AboutContent = {
  hero: {
    eyebrow: "동네 세일 지도",
    title: "우리 동네 세일",
    subtitle: "야채·정육·과일, 동네 가게의 실시간 떨이·할인을 지도에서 한눈에.",
    cta: "지도 시작하기 →",
  },
  blocks: [
    {
      id: "b1",
      title: "동네의 모든 세일, 지도 위에서.",
      desc: "검색하거나 현재 위치로 우리 동네를 펼쳐보세요. 세일중인 가게가 한눈에 들어와요.",
      emoji: "🗺️",
      gradient: "from-sky-100 to-blue-200",
    },
    {
      id: "b2",
      title: "지금 이 순간의 떨이까지.",
      desc: "마감 직전 떨이도 이웃의 실시간 제보로. 사진 여러 장과 ‘마감까지’ 만료 시간까지 담아요.",
      emoji: "🔥",
      gradient: "from-orange-500/30 to-red-500/40",
      dark: true,
    },
    {
      id: "b3",
      title: "사장님이 직접 관리하는 우리 가게.",
      desc: "사업자 인증을 받으면 메뉴·배너·소개를 사장님이 직접. 주민이 등록한 가게도 함께 키워가요.",
      emoji: "👑",
      gradient: "from-amber-100 to-yellow-200",
    },
    {
      id: "b4",
      title: "단골 가게는, 즐겨찾기로.",
      desc: "즐겨찾기한 가게의 세일 여부를 한눈에. 어느 동네에 있든 눌러서 바로 메뉴·세일·리뷰까지.",
      emoji: "♥",
      gradient: "from-pink-500/30 to-rose-500/40",
      dark: true,
    },
  ],
  closing: {
    title: "지금, 우리 동네 세일.",
    cta: "지도 열기 →",
    footer: "동네 세일 지도 · 수요 검증용 MVP",
  },
};

/** SiteConfig 저장값(JSON 문자열|null) → AboutContent. 깨졌으면 기본값. */
export function parseAbout(value: string | null | undefined): AboutContent {
  if (!value) return DEFAULT_ABOUT;
  try {
    const raw = JSON.parse(value) as Partial<AboutContent>;
    return {
      hero: { ...DEFAULT_ABOUT.hero, ...(raw.hero ?? {}) },
      blocks:
        Array.isArray(raw.blocks) && raw.blocks.length > 0
          ? raw.blocks.map((b, i) => ({
              id: b.id ?? `b${i}`,
              title: b.title ?? "",
              desc: b.desc ?? "",
              emoji: b.emoji ?? "✨",
              gradient: b.gradient ?? "from-gray-100 to-gray-200",
              imageUrl: b.imageUrl,
              dark: b.dark,
            }))
          : DEFAULT_ABOUT.blocks,
      closing: { ...DEFAULT_ABOUT.closing, ...(raw.closing ?? {}) },
    };
  } catch {
    return DEFAULT_ABOUT;
  }
}
