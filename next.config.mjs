/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 제보 사진은 Supabase Storage 등 외부 호스트에서 옴 → 허용 호스트는 Phase 3에서 추가.
  // TODO(phase-3): images.remotePatterns 에 Supabase Storage 도메인 등록
  images: {
    remotePatterns: [],
  },
  // TODO(phase-later): PWA 는 @serwist/next 로 구성 (next-pwa 대신, App Router 지원).
};

export default nextConfig;
