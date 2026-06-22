"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoEditor } from "./PhotoEditor";

const MAX_PHOTOS = 5;

/** 고객센터 문의 작성 폼. 닉네임/이메일/제목/내용 + 첨부 이미지(선택, 최대 5장 · 편집 가능). */
export function SupportForm({ defaultNickname }: { defaultNickname: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(defaultNickname);
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_PHOTOS - files.length;
    if (room <= 0) return setMsg(`사진은 최대 ${MAX_PHOTOS}장이에요.`);
    const picked = Array.from(list).slice(0, room);
    const firstNew = files.length; // 선택 즉시 편집모드 진입
    setFiles((f) => [...f, ...picked]);
    setPreviews((p) => [...p, ...picked.map((f) => URL.createObjectURL(f))]);
    setEditIdx(firstNew);
  };
  const replaceAt = (i: number, f: File) => {
    setFiles((arr) => arr.map((x, idx) => (idx === i ? f : x)));
    setPreviews((arr) => {
      URL.revokeObjectURL(arr[i]);
      return arr.map((x, idx) => (idx === i ? URL.createObjectURL(f) : x));
    });
  };
  const removeAt = (i: number) => {
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setPreviews((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, idx) => idx !== i);
    });
  };

  const submit = async () => {
    if (!nickname.trim() || !title.trim() || !content.trim()) return setMsg("닉네임·제목·내용을 입력해 주세요.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMsg("이메일 형식을 확인해 주세요.");
    setBusy(true);
    setMsg(null);
    try {
      // 첨부 사진 업로드(개별, 순차)
      const attachmentUrls: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const ud = (await up.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!up.ok || !ud.url) {
          setMsg(ud.error ?? "첨부 업로드 실패");
          return;
        }
        attachmentUrls.push(ud.url);
      }
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, email, title, content, attachmentUrls }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(res.status === 401 ? "로그인이 필요해요." : e.error ?? "접수 실패");
        return;
      }
      setMsg("문의가 접수됐어요! 답변은 ‘내 문의 내역’에서 확인할 수 있어요.");
      setTitle("");
      setContent("");
      previews.forEach((p) => URL.revokeObjectURL(p));
      setFiles([]);
      setPreviews([]);
      router.refresh();
    } catch {
      setMsg("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  const cls = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-sm font-bold">문의하기</h2>
      <div className="flex gap-2">
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" className={cls} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="회신 이메일" className={cls} />
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className={cls} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="문의 내용을 적어 주세요." className={`${cls} resize-none`} />

      {/* 첨부 사진 (선택, 최대 5장 · 편집 가능) */}
      <div className="grid grid-cols-4 gap-2">
        {previews.map((src, i) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-lg bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="삭제"
              className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => setEditIdx(i)}
              className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white"
            >
              편집
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-line bg-white text-[10px] text-ink-3"
          >
            <span className="text-lg">📷</span>
            {files.length === 0 ? "첨부" : `${files.length}/${MAX_PHOTOS}`}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = ""; // 같은 파일 재선택 허용
        }}
      />

      <button type="button" onClick={submit} disabled={busy} className="mt-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:bg-gray-300">
        {busy ? "접수 중…" : "작성하기"}
      </button>
      {msg && <p className="text-center text-xs text-ink-3">{msg}</p>}

      {editIdx !== null && files[editIdx] && (
        <PhotoEditor
          file={files[editIdx]}
          onSave={(f) => {
            replaceAt(editIdx, f);
            setEditIdx(null);
          }}
          onCancel={() => setEditIdx(null)}
        />
      )}
    </div>
  );
}
