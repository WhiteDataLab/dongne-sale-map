/** @type {import('next').NextConfig} */

// 전역 보안 응답 헤더 (클릭재킹·MIME 스니핑·정보유출·권한 남용 방어).
// CSP 는 카카오맵 SDK/이미지·Supabase 스토리지 등 외부 자원을 많이 쓰므로
// 우선 frame-ancestors(클릭재킹)만 강제하고, 전체 CSP 는 점진 도입(TODO) 한다.
const securityHeaders = [
  // 외부 사이트가 우리 페이지를 iframe 으로 감싸는 것을 차단(클릭재킹).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // 브라우저의 MIME 타입 추측 차단(업로드 콘텐츠 XSS 우회 방어).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 외부로 referer 경로/쿼리 유출 최소화.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 불필요한 강력 권한(카메라/마이크 등) 기본 차단. geolocation 은 지도 보조용으로 self 허용.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), geolocation=(self)" },
  // HTTPS 강제(배포 환경). 1년 + 서브도메인.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  // 제보 사진은 Supabase Storage 등 외부 호스트에서 옴 → 허용 호스트는 Phase 3에서 추가.
  // TODO(phase-3): images.remotePatterns 에 Supabase Storage 도메인 등록
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // TODO(phase-later): PWA 는 @serwist/next 로 구성 (next-pwa 대신, App Router 지원).
  // TODO(security): 전체 Content-Security-Policy(script/style/img/connect-src) 점진 도입.
};

export default nextConfig;
