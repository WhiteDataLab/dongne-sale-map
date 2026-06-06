"use client";

import { useRef, useState } from "react";
import { PhotoEditor } from "./PhotoEditor";

type Kind = "closed_today" | "shutdown";

/**
 * 휴업/폐업 제보 폼. 종류 선택 + 현장 사진(1장) + 한줄 메모 → /api/closures.
 * 다른 이웃에게 지도·상세에서 경고로 노출된다.
 */
export function ClosureReportForm({
  storeId,
  onDone,
  onCancel,
  onToast,
}: {
  storeId: string;
  onDone: () => void;
  onCancel: () => void;
  onToast: (msg: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("closed_today");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setEditing(true);
  };

  const submit = async () => {
    if (!file) return onToast("현장 사진 1장을 올려 주세요.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (!up.ok) {
        const e = (await up.json().catch(() => ({}))) as { error?: string };
        onToast(up.status === 401 ? "로그인이 필요해요." : e.error ?? "사진 업로드 실패");
        return;
      }
      const { url } = (await up.json()) as { url: string };

      const res = await fetch("/api/closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, kind, photoUrl: url, note }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        onToast(res.status === 401 ? "로그인이 필요해요." : e.error ?? "제보에 실패했어요.");
        return;
      }
      onToast(kind === "shutdown" ? "폐업 제보 완료! 이웃에게 알릴게요." : "휴업 제보 완료! 이웃에게 알릴게요.");
      onDone();
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-amber-800">🚪 문 닫았나요? 제보</h4>
        <button type="button" onClick={onCancel} className="text-sm text-gray-400">
          닫기
        </button>
      </div>

      <div className="flex gap-2">
        {([
          { k: "closed_today", label: "오늘 갑자기 휴업" },
          { k: "shutdown", label: "폐업한 것 같아요" },
        ] as { k: Kind; label: string }[]).map((o) => (
          <button
            key={o.k}
            type="button"
            onClick={() => setKind(o.k)}
            className={[
              "flex-1 rounded-lg border px-3 py-2 text-sm",
              kind === o.k
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-gray-200 bg-white text-gray-600",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* 현장 사진 1장 */}
      {preview ? (
        <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
          >
            ✏️ 편집
          </button>
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
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex aspect-video flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-sm text-gray-400"
        >
          <span className="text-2xl">📷</span>
          현장 사진 찍기 / 올리기
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="한줄 메모 (선택, 예: 셔터 내려가 있어요)"
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:bg-gray-300"
      >
        {busy ? "제보 중…" : "제보 보내기"}
      </button>

      {editing && file && (
        <PhotoEditor
          file={file}
          onSave={(f) => {
            if (preview) URL.revokeObjectURL(preview);
            setFile(f);
            setPreview(URL.createObjectURL(f));
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}
