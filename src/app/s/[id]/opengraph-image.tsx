import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { CATEGORY_META, type Category } from "@/lib/constants";

/**
 * 공유 OG 카드(브리프 P2 "공유 OG 카드 비주얼") — /s/[id] 링크 미리보기 이미지.
 * 디자인 토큰(잉크/딜 그라데이션)으로 브랜드 일관성. satori 는 woff2/이모지 미지원이라
 * Pretendard woff + 도형/텍스트만 사용한다.
 */
export const runtime = "nodejs";
export const alt = "동네 세일 지도 — 가게 세일 정보";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // OG 전용 woff는 assets/og 에 둔다(public 은 Vercel 람다 FS 에 없을 수 있음).
  const [regular, extrabold] = await Promise.all([
    readFile(path.join(process.cwd(), "assets/og/Pretendard-Regular.woff")),
    readFile(path.join(process.cwd(), "assets/og/Pretendard-ExtraBold.woff")),
  ]);

  const now = new Date();
  const store = await prisma.store
    .findUnique({
      where: { id },
      include: {
        sales: {
          where: { status: "active", expiresAt: { gt: now } },
          orderBy: { createdAt: "desc" },
        },
      },
    })
    .catch(() => null);

  const fonts = [
    { name: "Pretendard", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Pretendard", data: extrabold, weight: 800 as const, style: "normal" as const },
  ];

  if (!store) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            background: "#FFFFFF",
            fontFamily: "Pretendard",
            fontSize: 48,
            fontWeight: 800,
            color: "#191F28",
          }}
        >
          동네 세일 지도
        </div>
      ),
      { ...size, fonts },
    );
  }

  const meta = CATEGORY_META[store.category as Category];
  const top = store.sales[0];
  const name = store.name.length > 16 ? store.name.slice(0, 16) + "…" : store.name;
  const title = top ? (top.title.length > 20 ? top.title.slice(0, 20) + "…" : top.title) : "";
  const price = top?.salePrice != null ? top.salePrice.toLocaleString("ko-KR") : "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "64px",
          background: "linear-gradient(135deg, #FFFFFF 0%, #F2F5F9 100%)",
          fontFamily: "Pretendard",
        }}
      >
        {/* 브랜드 */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "13px",
              background: "linear-gradient(135deg, #FF6B35, #FF3B30)",
            }}
          />
          <div style={{ display: "flex", fontSize: "30px", fontWeight: 800, color: "#191F28" }}>
            동네 세일 지도
          </div>
        </div>

        {/* 가게명 */}
        <div
          style={{
            display: "flex",
            marginTop: "44px",
            fontSize: "74px",
            fontWeight: 800,
            color: "#191F28",
            letterSpacing: "-3px",
          }}
        >
          {name}
        </div>
        <div style={{ display: "flex", marginTop: "10px", fontSize: "30px", color: "#4E5968" }}>
          {meta.label} · {store.address}
        </div>

        {/* 세일 카드 / 폴백 */}
        {top ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "44px",
              padding: "34px 40px",
              background: "#FFF1ED",
              borderRadius: "28px",
              alignSelf: "flex-start",
              maxWidth: "1010px",
            }}
          >
            <div style={{ display: "flex", fontSize: "26px", fontWeight: 800, color: "#E0331F" }}>
              진행중인 세일 {store.sales.length}건
            </div>
            <div
              style={{ display: "flex", marginTop: "12px", fontSize: "34px", fontWeight: 400, color: "#191F28" }}
            >
              {title}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: "4px" }}>
              <div
                style={{ display: "flex", fontSize: "92px", fontWeight: 800, color: "#E0331F", letterSpacing: "-4px" }}
              >
                {price || "세일중"}
              </div>
              {price && (
                <div
                  style={{ display: "flex", fontSize: "36px", fontWeight: 800, color: "#E0331F", marginLeft: "6px" }}
                >
                  원
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", marginTop: "44px", fontSize: "34px", color: "#8B95A1" }}>
            메뉴·리뷰를 확인해보세요
          </div>
        )}

        {/* 푸터 */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontSize: "26px",
            color: "#8B95A1",
          }}
        >
          우리 동네 실시간 세일을 지도에서
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
