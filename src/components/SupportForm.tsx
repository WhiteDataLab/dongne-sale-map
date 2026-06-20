"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** 고객센터 문의 작성 폼. 닉네임/이메일/제목/내용 + 첨부 이미지(선택). */
export function SupportForm({ defaultNickname }: { defaultNickname: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(defaultNickname);
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!nickname.trim() || !title.trim() || !content.trim()) return setMsg("닉네임·제목·내용을 입력해 주세요.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMsg("이메일 형식을 확인해 주세요.");
    setBusy(true);
    setMsg(null);
    try {
      let attachmentUrl: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const ud = (await up.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!up.ok || !ud.url) {
          setMsg(ud.error ?? "첨부 업로드 실패");
          return;
        }
        attachmentUrl = ud.url;
      }
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, email, title, content, attachmentUrl }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(res.status === 401 ? "로그인이 필요해요." : e.error ?? "접수 실패");
        return;
      }
      setMsg("문의가 접수됐어요! 답변은 ‘내 문의 내역’에서 확인할 수 있어요.");
      setTitle("");
      setContent("");
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
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

      {preview ? (
        <div className="relative w-32">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="aspect-square w-32 rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => {
              if (preview) URL.revokeObjectURL(preview);
              setFile(null);
              setPreview(null);
            }}
            className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
          >
            ×
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} className="self-start rounded-lg border border-dashed border-line px-3 py-1.5 text-xs text-ink-3">
          📎 파일 첨부 (이미지, 선택)
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (!f) return;
          if (preview) URL.revokeObjectURL(preview);
          setFile(f);
          setPreview(URL.createObjectURL(f));
        }}
      />

      <button type="button" onClick={submit} disabled={busy} className="mt-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:bg-gray-300">
        {busy ? "접수 중…" : "작성하기"}
      </button>
      {msg && <p className="text-center text-xs text-ink-3">{msg}</p>}
    </div>
  );
}
