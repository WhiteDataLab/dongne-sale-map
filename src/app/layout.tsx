import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "동네 세일 지도",
  description:
    "동네 식료품 소상공인(야채/정육/과일)의 실시간 세일·할인 정보를 지도에서 보고 직접 제보하는 하이퍼로컬 웹 서비스.",
  // TODO(phase-later): PWA manifest 연결 (@serwist/next)
};

export const viewport: Viewport = {
  // 모바일 웹 우선(mobile-first). 지도 풀스크린 대비 확대 제한.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="flex h-dvh flex-col overflow-hidden">
        <Header />
        <main className="relative flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
