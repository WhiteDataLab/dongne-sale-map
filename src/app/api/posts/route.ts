import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getLaunchFlags } from "@/lib/launchFlags";
import { screenReview } from "@/lib/moderation";

/**
 * P1-7 동네 절약방(가벼운 커뮤니티, 브리프 §8-7 — 거지맵 '거지방' 정서).
 * - GET: 공개 목록(숨김 제외, 최신순). region 필터 선택.
 * - POST: 로그인 필수. 절약 꿀팁·득템 자랑 한 줄 글(2~300자) + 동(洞) 스냅샷.
 *   모더레이션: 작성 시 screenReview 로 욕설·음란·광고를 즉시 거절(리뷰의 '보류'와 달리
 *   글은 독립 콘텐츠라 바로 거절해도 억울 소지가 적음) + 신고 누적 자동 숨김(post) + 레이트리밋.
 *   `flag_community` 킬스위치 OFF 면 403(모더레이션 사고 시 긴급 잠금).
 */
export const runtime = "nodejs";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3; // 1분 3건 — 짧은 글 특성상 보수적으로
const MAX_BODY = 300;
const MAX_REGION = 20;

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region")?.trim();
  try {
    const posts = await prisma.neighborhoodPost.findMany({
      where: { hidden: false, ...(region ? { region } : {}) },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        region: true,
        body: true,
        createdAt: true,
        authorId: true,
        author: { select: { nickname: true } },
      },
    });
    return NextResponse.json({
      posts: posts.map((p) => ({
        id: p.id,
        region: p.region,
        body: p.body,
        nickname: p.author.nickname,
        authorId: p.authorId,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ posts: [] });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  if (!(await getLaunchFlags()).community) {
    return NextResponse.json({ error: "지금은 절약방이 잠시 닫혀 있어요." }, { status: 403 });
  }

  let body: { body?: string; region?: string };
  try {
    body = (await req.json()) as { body?: string; region?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const text = (body.body ?? "").trim();
  if (text.length < 2) {
    return NextResponse.json({ error: "내용을 2자 이상 적어주세요." }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `내용은 ${MAX_BODY}자까지 쓸 수 있어요.` }, { status: 400 });
  }
  const region = (body.region ?? "").trim().slice(0, MAX_REGION) || "우리 동네";

  // 자동 모더레이션: 부적절 표현은 즉시 거절(가이드 안내)
  const screened = screenReview(`${region} ${text}`);
  if (screened.flagged) {
    return NextResponse.json(
      { error: `커뮤니티 가이드에 맞지 않는 표현이 있어요. (${screened.reason})` },
      { status: 400 },
    );
  }

  try {
    // 레이트리밋: 최근 1분 내 RATE_MAX 건 초과 차단
    const recent = await prisma.neighborhoodPost.count({
      where: { authorId: userId, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
    });
    if (recent >= RATE_MAX) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해 주세요. (너무 빠른 연속 작성)" },
        { status: 429 },
      );
    }

    const post = await prisma.neighborhoodPost.create({
      data: { authorId: userId, region, body: text },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, postId: post.id });
  } catch {
    return NextResponse.json({ error: "작성에 실패했어요." }, { status: 500 });
  }
}
