"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewDateLabel } from "@/lib/format";
import { ReportButton } from "./ReportButton";

/** 절약방 글 DTO (api/posts GET). */
export type NhPostDTO = {
  id: string;
  region: string;
  body: string;
  nickname: string;
  authorId: string;
  createdAt: string;
};

/**
 * P1-7 동네 절약방(가벼운 커뮤니티) — 절약 꿀팁·득템 자랑 한 줄 게시판.
 * 거지맵 '거지방' 정서: 절약을 부끄러움이 아닌 놀이·연대로. 서버가 목록을 내려주고(SSR),
 * 작성/삭제 후엔 router.refresh 로 갱신. 신고는 기존 ReportButton(자동 숨김) 재사용.
 */
export function NeighborhoodBoard({
  posts,
  viewerId,
  isAdmin,
  defaultRegion,
}: {
  posts: NhPostDTO[];
  viewerId: string | null;
  isAdmin: boolean;
  defaultRegion?: string; // 동네 랭킹 1위 등으로 미리 채워줄 동 이름
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [region, setRegion] = useState(defaultRegion ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const toast = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  };

  const submit = async () => {
    if (busy) return;
    if (body.trim().length < 2) return toast("내용을 2자 이상 적어주세요.");
    setBusy(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), region: region.trim() }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 401) return toast("로그인하고 이웃과 꿀팁을 나눠보세요!");
      if (!res.ok) return toast(d.error ?? "작성에 실패했어요.");
      setBody("");
      toast("올렸어요! 이웃들이 곧 봐요 💬");
      router.refresh();
    } catch {
      toast("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("삭제했어요.");
      router.refresh();
    } else {
      toast(res.status === 403 ? "권한이 없어요." : "삭제에 실패했어요.");
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-extrabold text-ink">💬 동네 절약방</h2>
        <span className="text-[11px] text-ink-4">절약 꿀팁 · 오늘 득템 자랑</span>
      </div>

      {/* 작성 — 비로그인이면 제출 시 로그인 안내(조회는 자유) */}
      <div className="mt-2.5 flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="예: 이문 청과 딸기 한 박스 5천원에 득템! 오후에 가면 더 싸요 🍓"
          className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <div className="flex items-center gap-2">
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            maxLength={20}
            placeholder="동네 (예: 이문동)"
            className="w-32 rounded-lg border border-line px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="min-h-[44px] flex-1 rounded-btn bg-brand text-sm font-bold text-white disabled:bg-gray-300"
          >
            {busy ? "올리는 중…" : "이웃에게 공유"}
          </button>
        </div>
      </div>

      {/* 목록 */}
      {posts.length === 0 ? (
        <p className="mt-3 rounded-xl bg-surface-2 p-4 text-center text-sm text-ink-3">
          아직 글이 없어요. 오늘 아낀 이야기를 첫 글로 남겨보세요!
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line-2">
          {posts.map((p) => (
            <li key={p.id} className="py-2.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="rounded-full bg-brand-wash px-2 py-0.5 font-bold text-brand-ink">
                  {p.region}
                </span>
                <span className="font-semibold text-ink-2">{p.nickname}</span>
                <span className="text-ink-4">· {reviewDateLabel(p.createdAt)}</span>
                <span className="ml-auto flex items-center gap-2">
                  {(viewerId === p.authorId || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      className="text-xs text-red-500"
                    >
                      삭제
                    </button>
                  )}
                  {viewerId !== p.authorId && (
                    <ReportButton targetType="post" targetId={p.id} onToast={toast} onChanged={() => router.refresh()} />
                  )}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{p.body}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-ink-4">
        서로 기분 좋게! 욕설·광고·허위 글은 자동/신고로 숨겨져요.{" "}
        <Link href="/policy" className="underline">
          커뮤니티 가이드
        </Link>
      </p>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4">
          <div className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">{notice}</div>
        </div>
      )}
    </section>
  );
}
