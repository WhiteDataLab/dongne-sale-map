"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** 관리자: 소개 페이지(/about) 영상 업로드/교체/삭제. */
export function IntroVideoUploader({ current }: { current: string | null }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/intro-video", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "업로드 실패");
        return;
      }
      setMsg("업로드 완료! 소개 페이지에 반영됐어요.");
      router.refresh();
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    await fetch("/api/admin/intro-video", { method: "DELETE" });
    setBusy(false);
    setMsg("영상을 삭제했어요.");
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-line p-4">
      <p className="font-medium">소개 페이지 영상</p>
      <p className="mt-0.5 text-xs text-ink-3">/about 상단에 표시될 영상 (mp4·webm·mov, 50MB 이하)</p>

      {current && (
        <video src={current} controls playsInline className="mt-3 aspect-video w-full rounded-lg bg-black" />
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:bg-gray-300"
        >
          {busy ? "처리 중…" : current ? "영상 교체" : "영상 업로드"}
        </button>
        {current && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2"
          >
            삭제
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      {msg && <p className="mt-2 text-xs text-ink-3">{msg}</p>}
    </div>
  );
}
