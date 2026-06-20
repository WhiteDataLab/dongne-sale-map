"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

type Step = "phone" | "code" | "signup";

/** 로그인 수단 선택 + 전화번호 로그인/간단가입 (Phase 5b). */
export function LoginOptions({
  naverEnabled,
  kakaoEnabled,
  callbackUrl = "/",
}: {
  naverEnabled: boolean;
  kakaoEnabled: boolean;
  callbackUrl?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [name, setName] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { error?: string; devCode?: string };
      if (!res.ok) return setMsg(data.error ?? "발송 실패");
      setDevCode(data.devCode ?? null);
      setStep("code");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = (await res.json()) as { error?: string; registered?: boolean };
      if (!res.ok) return setMsg(data.error ?? "인증 실패");
      if (data.registered) {
        await doPhoneLogin();
      } else {
        setStep("signup"); // 신규 → 간단가입
      }
    } finally {
      setBusy(false);
    }
  };

  const doPhoneLogin = async () => {
    setBusy(true);
    const res = await signIn("phone", {
      phone,
      code,
      nickname,
      name,
      redirect: false,
    });
    setBusy(false);
    if (res?.ok) router.push(callbackUrl);
    else setMsg("로그인에 실패했어요. 인증번호를 다시 받아주세요.");
  };

  const inputClass =
    "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand";
  const primaryBtn =
    "w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink active:bg-blue-800 disabled:bg-gray-300";

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 p-6">
      <Link href="/" className="text-sm text-ink-3">
        ← 지도로
      </Link>
      <h1 className="text-xl font-bold">로그인 / 회원가입</h1>

      {/* 소셜 */}
      <div className="flex flex-col gap-2">
        {naverEnabled && (
          <button
            type="button"
            onClick={() => signIn("naver", { callbackUrl })}
            className="rounded-lg bg-[#03C75A] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#02b350] active:bg-[#029a45]"
          >
            네이버로 시작하기
          </button>
        )}
        {kakaoEnabled && (
          <button
            type="button"
            onClick={() => signIn("kakao", { callbackUrl })}
            className="rounded-lg bg-[#FEE500] py-2.5 text-sm font-medium text-[#191600] transition-colors hover:bg-[#f2d900] active:bg-[#e6cf00]"
          >
            카카오로 시작하기
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-ink-4">
        <span className="h-px flex-1 bg-gray-200" />
        또는 전화번호
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      {/* 전화번호 */}
      {step === "phone" && (
        <div className="flex flex-col gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="휴대폰 번호 (01012345678)"
            className={inputClass}
          />
          <button type="button" onClick={sendCode} disabled={busy} className={primaryBtn}>
            {busy ? "발송 중…" : "인증번호 받기"}
          </button>
        </div>
      )}

      {step === "code" && (
        <div className="flex flex-col gap-2">
          {devCode && (
            <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
              개발모드 인증번호: <b>{devCode}</b>
            </p>
          )}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="인증번호 6자리"
            className={inputClass}
          />
          <button type="button" onClick={verifyCode} disabled={busy} className={primaryBtn}>
            {busy ? "확인 중…" : "확인"}
          </button>
        </div>
      )}

      {step === "signup" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ink-3">처음 오셨네요! 간단히 가입할게요.</p>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임 (필수)"
            className={inputClass}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 (선택)"
            className={inputClass}
          />
          <button
            type="button"
            onClick={doPhoneLogin}
            disabled={busy || !nickname.trim()}
            className={primaryBtn}
          >
            {busy ? "가입 중…" : "가입하고 시작하기"}
          </button>
        </div>
      )}

      {msg && <p className="text-center text-sm text-red-500">{msg}</p>}
    </div>
  );
}
