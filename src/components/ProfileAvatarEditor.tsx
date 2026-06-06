"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCropper } from "./CircleCropper";
import { updateProfileImage } from "@/app/account/actions";

/** 마이페이지 프로필 사진: 클릭 → 파일 선택 → 원형 크롭 → 업로드 → 반영. */
export function ProfileAvatarEditor({
  currentUrl,
  nickname,
}: {
  currentUrl: string | null;
  nickname: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onCropped = async (f: File) => {
    setPicked(null);
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (!up.ok) {
        const e = (await up.json().catch(() => ({}))) as { error?: string };
        setMsg(e.error ?? "업로드 실패");
        return;
      }
      const { url } = (await up.json()) as { url: string };
      await updateProfileImage(url);
      setMsg("프로필 사진을 변경했어요.");
      router.refresh();
    } catch {
      setMsg("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await updateProfileImage(null);
      setMsg("기본 이미지로 변경했어요.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="group relative size-20 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200"
        aria-label="프로필 사진 변경"
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-3xl">🙂</span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-medium text-white">
          {busy ? "처리 중" : "변경"}
        </span>
      </button>

      <div className="min-w-0">
        <p className="truncate font-medium">{nickname}님</p>
        <p className="mt-0.5 text-xs text-gray-400">프로필 사진을 눌러 변경할 수 있어요.</p>
        <div className="mt-1 flex gap-3 text-xs">
          <button type="button" onClick={() => fileRef.current?.click()} className="font-medium text-blue-600">
            사진 변경
          </button>
          {currentUrl && (
            <button type="button" onClick={remove} className="text-gray-400">
              기본으로
            </button>
          )}
        </div>
        {msg && <p className="mt-1 text-xs text-gray-500">{msg}</p>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) setPicked(f);
          e.target.value = "";
        }}
      />

      {picked && (
        <CircleCropper file={picked} onSave={onCropped} onCancel={() => setPicked(null)} />
      )}
    </div>
  );
}
