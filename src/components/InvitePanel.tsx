"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShareButton } from "./ShareButton";

/** 추천 코드 공유 + (신규 한정) 추천 코드 입력. */
export function InvitePanel({
  code,
  canEnter,
  point = 50,
}: {
  code: string;
  canEnter: boolean;
  point?: number;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const sharePath = `/i/${code}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("이 링크를 복사하세요", `${window.location.origin}${sharePath}`);
    }
  };

  const submit = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: input.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "처리에 실패했어요." });
        return;
      }
      setMsg({ ok: true, text: data.message ?? "완료!" });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "네트워크 오류가 발생했어요." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 내 코드 */}
      <div className="rounded-2xl border border-line bg-white p-4 text-center">
        <p className="text-xs text-ink-3">내 추천 코드</p>
        <p className="mt-1 text-2xl font-extrabold tracking-widest text-brand">{code}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={copyCode}
            className="flex-1 rounded-lg border border-line py-2 text-sm font-medium text-ink-2 hover:bg-surface-2"
          >
            {copied ? "✅ 링크 복사됨" : "🔗 초대 링크 복사"}
          </button>
          <ShareButton
            path={sharePath}
            title="동네 세일 지도 초대"
            text={`내 추천 코드로 가입하면 둘 다 +${point}P! 동네 세일 지도에서 만나요`}
            className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white"
          >
            친구 초대하기
          </ShareButton>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          친구가 이 링크로 가입하면 <b className="text-brand">나와 친구 각각 +{point}P</b>!
        </p>
      </div>

      {/* 코드 입력(신규 한정) */}
      {canEnter && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">추천 코드를 받으셨나요?</p>
          <p className="mt-0.5 text-xs text-amber-700">
            가입 7일 이내에 친구 코드를 입력하면 둘 다 +{point}P를 받아요. (1회)
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              placeholder="추천 코드 입력"
              maxLength={12}
              className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy || !input.trim()}
              className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-300"
            >
              {busy ? "확인 중…" : "적용"}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`text-center text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
      )}
    </div>
  );
}
