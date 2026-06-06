import { NextRequest, NextResponse } from "next/server";

/**
 * 추천 링크: /i/CODE → ref_code 쿠키(7일) 저장 후 로그인으로 이동.
 * 신규 가입 시 auth 콜백이 쿠키를 읽어 추천인·친구 각 +50P 지급.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  const res = NextResponse.redirect(new URL("/login", req.url));
  if (clean) {
    res.cookies.set("ref_code", clean, {
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return res;
}
