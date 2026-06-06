"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveVerifiedContact, removeContact } from "@/app/account/actions";

/** 기프티콘 수령 연락처 — SMS 인증 후 저장. (추천 보상은 인증된 연락처만) */
export function ContactVerifyForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!current);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sendCode = async () => {
    if (!phone.trim()) return setMsg("휴대폰 번호를 입력해 주세요.");
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; dev?: boolean; devCode?: string };
      if (!res.ok) return setMsg(d.error ?? "발송 실패");
      setSent(true);
      setDevCode(d.devCode ?? null);
      setMsg("인증번호를 발송했어요.");
    } catch {
      setMsg("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!code.trim()) return setMsg("인증번호를 입력해 주세요.");
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setMsg(d.error ?? "인증 실패");
      // 인증 완료 → 서버에 연락처 저장(보류 추천 보상 지급)
      const saved = await saveVerifiedContact(phone);
      if (!saved.ok) return setMsg(saved.error ?? "저장 실패");
      setMsg("연락처가 인증·저장됐어요!");
      setEditing(false);
      setSent(false);
      setCode("");
      router.refresh();
    } catch {
      setMsg("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  const cls = "min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500";
  const btn = "shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100";

  if (current && !editing) {
    return (
      <div>
        <p className="text-sm">
          <span className="font-medium">{current}</span>
          <span className="ml-1 rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700">인증됨</span>
        </p>
        <div className="mt-2 flex gap-3 text-xs">
          <button type="button" onClick={() => setEditing(true)} className="font-medium text-blue-600">
            번호 변경
          </button>
          <button
            type="button"
            onClick={async () => {
              await removeContact();
              router.refresh();
            }}
            className="text-gray-400"
          >
            삭제
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder="010-1234-5678"
          className={cls}
        />
        <button type="button" onClick={sendCode} disabled={busy} className={btn}>
          {sent ? "재발송" : "인증번호 받기"}
        </button>
      </div>
      {sent && (
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="인증번호 6자리"
            className={cls}
          />
          <button type="button" onClick={verify} disabled={busy} className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:bg-gray-300">
            확인
          </button>
        </div>
      )}
      {devCode && <p className="text-xs text-amber-600">개발용 인증번호: {devCode}</p>}
      {current && (
        <button type="button" onClick={() => setEditing(false)} className="self-start text-xs text-gray-400">
          취소
        </button>
      )}
      {msg && <p className="text-xs text-gray-500">{msg}</p>}
    </div>
  );
}
