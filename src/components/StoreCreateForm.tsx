"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/constants";

/** 가게 등록 폼 (스펙 Phase 6, 소비자). 주소→지오코딩으로 좌표 저장. */
export function StoreCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("vegetable");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return setMsg("가게명을 입력해 주세요.");
    if (!address.trim()) return setMsg("주소를 입력해 주세요.");
    setBusy(true);
    setMsg(null);
    setNeedLogin(false);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, address, phone, description }),
      });
      if (res.status === 401) {
        setNeedLogin(true);
        return;
      }
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        return setMsg(e.error ?? "등록에 실패했어요.");
      }
      router.push("/");
      router.refresh();
    } catch {
      setMsg("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500";

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3 p-5">
      <Link href="/" className="text-sm text-gray-400">
        ← 지도로
      </Link>
      <h1 className="text-xl font-bold">가게 등록</h1>
      <p className="text-xs text-gray-500">
        동네 가게를 등록해 주세요. 등록한 가게는 검토 후 인증돼요. (사장님은 추후 직접 인증
        가능)
      </p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="가게명 (예: 이문 청과)"
        className={inputClass}
      />

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={[
              "rounded-lg border px-3 py-2 text-sm transition-colors",
              category === c
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="주소 (예: 서울 동대문구 이문로 100)"
        className={inputClass}
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        placeholder="전화번호 (선택)"
        className={inputClass}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="가게 소개 (선택)"
        className={`${inputClass} resize-none`}
      />

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300"
      >
        {busy ? "등록 중…" : "가게 등록"}
      </button>

      {needLogin && (
        <p className="text-center text-sm text-gray-500">
          로그인이 필요해요.{" "}
          <Link href="/login" className="font-medium text-blue-600">
            로그인하러 가기
          </Link>
        </p>
      )}
      {msg && <p className="text-center text-sm text-red-500">{msg}</p>}
    </div>
  );
}
