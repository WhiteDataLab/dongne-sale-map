"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AboutBlock, AboutContent } from "@/lib/about";

/**
 * 관리자 전용 /about 인라인 편집기.
 * 떠 있는 '✏️ 소개 편집' 버튼 → 전체화면 폼. 글·이미지·영상 업로드/수정.
 */
export function AboutEditor({
  content,
  introVideo,
}: {
  content: AboutContent;
  introVideo: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AboutContent>(() => structuredClone(content));
  const [video, setVideo] = useState<string | null>(introVideo);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2500);
  };

  const setHero = (patch: Partial<AboutContent["hero"]>) =>
    setDraft((d) => ({ ...d, hero: { ...d.hero, ...patch } }));
  const setClosing = (patch: Partial<AboutContent["closing"]>) =>
    setDraft((d) => ({ ...d, closing: { ...d.closing, ...patch } }));
  const setBlock = (i: number, patch: Partial<AboutBlock>) =>
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    }));
  const moveBlock = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const blocks = [...d.blocks];
      const j = i + dir;
      if (j < 0 || j >= blocks.length) return d;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...d, blocks };
    });
  const removeBlock = (i: number) =>
    setDraft((d) => ({ ...d, blocks: d.blocks.filter((_, idx) => idx !== i) }));
  const addBlock = () =>
    setDraft((d) => ({
      ...d,
      blocks: [
        ...d.blocks,
        {
          id: `b${Date.now()}`,
          title: "새 섹션 제목",
          desc: "섹션 설명을 입력하세요.",
          emoji: "✨",
          gradient: "from-gray-100 to-gray-200",
        },
      ],
    }));

  /** 이미지 업로드 → 공개 URL. (sale-photos 버킷 재사용) */
  const uploadImage = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      flash(data.error ?? "이미지 업로드 실패");
      return null;
    }
    return data.url;
  };

  const uploadVideo = async (file: File) => {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/intro-video", { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    setBusy(false);
    if (!res.ok || !data.url) return flash(data.error ?? "영상 업로드 실패");
    setVideo(data.url);
    flash("영상을 저장했어요. 저장 후 반영돼요.");
  };
  const removeVideo = async () => {
    setBusy(true);
    await fetch("/api/admin/intro-video", { method: "DELETE" });
    setBusy(false);
    setVideo(null);
    flash("영상을 삭제했어요.");
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/about", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        flash(e.error ?? "저장 실패");
        return;
      }
      flash("저장됐어요!");
      setOpen(false);
      router.refresh();
    } catch {
      flash("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";
  const labelCls = "text-xs font-medium text-ink-3";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(structuredClone(content));
          setVideo(introVideo);
          setOpen(true);
        }}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-brand-ink"
      >
        ✏️ 소개 편집
      </button>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-line-2 px-4 py-3">
          <h2 className="text-base font-bold">서비스 소개 편집</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
            >
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>

        {/* 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* 히어로 */}
          <fieldset className="mb-6">
            <legend className="mb-2 text-sm font-bold">상단(히어로)</legend>
            <div className="flex flex-col gap-2">
              <label className={labelCls}>윗말(eyebrow)</label>
              <input value={draft.hero.eyebrow} onChange={(e) => setHero({ eyebrow: e.target.value })} className={inputCls} />
              <label className={labelCls}>큰 제목</label>
              <input value={draft.hero.title} onChange={(e) => setHero({ title: e.target.value })} className={inputCls} />
              <label className={labelCls}>부제</label>
              <textarea value={draft.hero.subtitle} onChange={(e) => setHero({ subtitle: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
              <label className={labelCls}>버튼 문구</label>
              <input value={draft.hero.cta} onChange={(e) => setHero({ cta: e.target.value })} className={inputCls} />
            </div>
          </fieldset>

          {/* 영상 */}
          <fieldset className="mb-6">
            <legend className="mb-2 text-sm font-bold">소개 영상</legend>
            {video ? (
              <video src={video} controls playsInline className="mb-2 aspect-video w-full rounded-lg bg-black" />
            ) : (
              <p className="mb-2 text-xs text-ink-3">등록된 영상이 없어요. (mp4·webm·mov, 50MB 이하)</p>
            )}
            <VideoButtons busy={busy} hasVideo={!!video} onPick={uploadVideo} onRemove={removeVideo} />
          </fieldset>

          {/* 블록 */}
          <fieldset className="mb-6">
            <legend className="mb-2 text-sm font-bold">콘텐츠 섹션</legend>
            <div className="flex flex-col gap-4">
              {draft.blocks.map((b, i) => (
                <BlockCard
                  key={b.id}
                  block={b}
                  index={i}
                  total={draft.blocks.length}
                  onChange={(patch) => setBlock(i, patch)}
                  onMove={(dir) => moveBlock(i, dir)}
                  onRemove={() => removeBlock(i)}
                  onUploadImage={uploadImage}
                  inputCls={inputCls}
                  labelCls={labelCls}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addBlock}
              className="mt-3 w-full rounded-lg border border-dashed border-blue-400 py-2 text-sm font-medium text-brand"
            >
              ＋ 섹션 추가
            </button>
          </fieldset>

          {/* 마무리 */}
          <fieldset className="mb-2">
            <legend className="mb-2 text-sm font-bold">마무리</legend>
            <div className="flex flex-col gap-2">
              <label className={labelCls}>제목</label>
              <input value={draft.closing.title} onChange={(e) => setClosing({ title: e.target.value })} className={inputCls} />
              <label className={labelCls}>버튼 문구</label>
              <input value={draft.closing.cta} onChange={(e) => setClosing({ cta: e.target.value })} className={inputCls} />
              <label className={labelCls}>맨 아래 작은 글씨</label>
              <input value={draft.closing.footer} onChange={(e) => setClosing({ footer: e.target.value })} className={inputCls} />
            </div>
          </fieldset>
        </div>

        {msg && (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center">
            <div className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">{msg}</div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function VideoButtons({
  busy,
  hasVideo,
  onPick,
  onRemove,
}: {
  busy: boolean;
  hasVideo: boolean;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:bg-gray-300"
      >
        {hasVideo ? "영상 교체" : "영상 업로드"}
      </button>
      {hasVideo && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2"
        >
          삭제
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function BlockCard({
  block,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  onUploadImage,
  inputCls,
  labelCls,
}: {
  block: AboutBlock;
  index: number;
  total: number;
  onChange: (patch: Partial<AboutBlock>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onUploadImage: (f: File) => Promise<string | null>;
  inputCls: string;
  labelCls: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-3">섹션 {index + 1}</span>
        <div className="flex items-center gap-1.5 text-xs">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="px-1 text-ink-3 disabled:text-ink-4">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="px-1 text-ink-3 disabled:text-ink-4">↓</button>
          <button type="button" onClick={onRemove} className="px-1 text-red-500">삭제</button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelCls}>제목</label>
        <input value={block.title} onChange={(e) => onChange({ title: e.target.value })} className={inputCls} />
        <label className={labelCls}>설명</label>
        <textarea value={block.desc} onChange={(e) => onChange({ desc: e.target.value })} rows={2} className={`${inputCls} resize-none`} />

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-ink-2">
            <input type="checkbox" checked={!!block.dark} onChange={(e) => onChange({ dark: e.target.checked })} />
            어두운 배경
          </label>
          <label className="flex items-center gap-1 text-xs text-ink-2">
            이모지
            <input
              value={block.emoji}
              onChange={(e) => onChange({ emoji: e.target.value })}
              className="w-12 rounded border border-line px-1 py-0.5 text-center"
            />
          </label>
        </div>

        {/* 이미지 */}
        {block.imageUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={block.imageUrl} alt="" className="aspect-video w-full rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => onChange({ imageUrl: undefined })}
              className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white"
            >
              이미지 제거
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-dashed border-line py-2 text-xs font-medium text-ink-3 disabled:text-ink-4"
          >
            {uploading ? "업로드 중…" : "＋ 이미지 업로드 (없으면 이모지로 표시)"}
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploading(true);
            const url = await onUploadImage(f);
            setUploading(false);
            if (url) onChange({ imageUrl: url });
          }}
        />
      </div>
    </div>
  );
}
