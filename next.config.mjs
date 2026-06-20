/** @type {import('next').NextConfig} */

// 전역 Content-Security-Policy.
// 카카오맵 JS SDK(dapi.kakao.com + *.daumcdn.net 타일, 내부적으로 eval/inline 사용)와
// Supabase 스토리지(*.supabase.co) 를 허용하되, 그 외 출처의 스크립트/연결/object 는 차단한다.
// ⚠️ 카카오 SDK 가 eval·inline 을 쓰므로 script-src 에 'unsafe-eval'/'unsafe-inline' 이 불가피.
//    (nonce 기반 strict CSP 는 SDK 호환성 문제로 미적용 — 그래도 출처 화이트리스트로 원격 스크립트 주입은 차단됨)
// 토스페이먼츠(M2 결제): SDK(js.tosspayments.com) + API(api.tosspayments.com) + 인증창(*.tosspayments.com).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.kakao.com https://*.daumcdn.net https://js.tosspayments.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.kakao.com https://*.daumcdn.net https://*.daum.net https://*.supabase.co https://*.tosspayments.com",
  "frame-src 'self' https://*.kakao.com https://*.daum.net https://*.tosspayments.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // 클릭재킹: 외부 사이트의 iframe 임베드 차단
].join("; ");

// 전역 보안 응답 헤더 (클릭재킹·MIME 스니핑·정보유출·권한 남용 방어).
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // 구형 브라우저용 클릭재킹 방어(CSP frame-ancestors 백업).
  { key: "X-Frame-Options", value: "DENY" },
  // 브라우저의 MIME 타입 추측 차단(업로드 콘텐츠 XSS 우회 방어).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 외부로 referer 경로/쿼리 유출 최소화.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 불필요한 강력 권한(카메라/마이크 등) 기본 차단. geolocation 은 지도 보조용으로 self 허용.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(self), geolocation=(self)" },
  // HTTPS 강제(배포 환경). 1년 + 서브도메인.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  // OG 동적 이미지(/s/[id]/opengraph-image)가 fs 로 읽는 woff 폰트를 Vercel 번들에 포함.
  outputFileTracingIncludes: {
    "/s/[id]/opengraph-image": ["./assets/og/**"],
  },
  // 제보 사진은 Supabase Storage 등 외부 호스트에서 옴 → 허용 호스트는 Phase 3에서 추가.
  // TODO(phase-3): images.remotePatterns 에 Supabase Storage 도메인 등록
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // TODO(phase-later): PWA 는 @serwist/next 로 구성 (next-pwa 대신, App Router 지원).
  // TODO(security): script-src 의 'unsafe-inline'/'unsafe-eval' 을 nonce 기반으로 축소(카카오 SDK 호환 확인 후).
};

export default nextConfig;
