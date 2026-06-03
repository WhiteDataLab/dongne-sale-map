"use client";

import { useRef, useState } from "react";

/** 사장님 인증 신청 (Phase 7a). 가게 상세 공지 탭에서 사업자등록증 업로드. */
export function MerchantApply({
  storeId,
  hasOwner,
  isOwner,
  onToast,
}: {
  storeId: string;
  hasOwner: boolean;
  isOwner: boolean;
  onToast: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  if (isOwner) {
    return <p className="text-xs font-medium text-amber-700">👑 사장님으로 인증된 내 가게예요.</p>;
  }
  if (hasOwner) {
    return <p className="text-xs text-gray-400">사장님이 인증한 가게예요.</p>;
  }
  if (done) {
    return <p className="text-xs text-blue-600">인증 신청 완료 — 관리자 검토 후 승인돼요.</p>;
  }

  const submit = async () => {
    if (!file) return onToast("사업자등록증 파일을 첨부해 주세요.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("storeId", storeId);
      const res = await fetch("/api/merchant/apply", { method: "POST", body: fd });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        onToast(res.status === 401 ? "로그인이 필요해요." : e.error ?? "신청에 실패했어요.");
        return;
      }
      setDone(true);
      onToast("인증 신청 완료! 관리자 검토 후 승인돼요.");
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline"
      >
        이 가게 사장님이신가요? 인증 신청 →
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <p className="text-xs text-gray-600">
        사업자등록증 사진(또는 PDF)을 올려주세요. 관리자 확인 후 사장님 권한이 부여돼요.
      </p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="truncate rounded border border-gray-300 bg-white px-3 py-2 text-left text-xs"
      >
        {file ? `📎 ${file.name}` : "파일 첨부"}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex-1 rounded bg-blue-600 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
        >
          {busy ? "신청 중…" : "인증 신청"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-gray-300 px-3 text-xs text-gray-500"
        >
          취소
        </button>
      </div>
    </div>
  );
}
