"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/constants";
import { MapPicker } from "./MapPicker";

/** 가게 등록 폼 (스펙 Phase 6, 소비자). 주소→지오코딩으로 좌표 저장. */
export function StoreCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("vegetable");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState(false);

  // 검색 결과(카카오 장소)에서 넘어온 경우 prefill (?name=&address=&lat=&lng=&phone=)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const n = p.get("name");
    if (n) setName(n);
    const a = p.get("address");
    if (a) setAddress(a);
    const ph = p.get("phone");
    if (ph) setPhone(ph);
    const lat = Number(p.get("lat"));
    const lng = Number(p.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) {
      setPicked({ lat, lng });
    }
  }, []);

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
        body: JSON.stringify({
          name,
          category,
          address,
          phone,
          description,
          ...(picked ? { lat: picked.lat, lng: picked.lng } : {}),
        }),
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
    "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand";

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3 p-5">
      <Link href="/" className="text-sm text-ink-3">
        ← 지도로
      </Link>
      <h1 className="text-xl font-bold">가게 등록</h1>
      <p className="text-xs text-ink-3">
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
                ? "border-brand bg-brand text-white"
                : "border-line bg-white text-ink-2 hover:bg-surface-2",
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
      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        className="rounded-lg border border-line py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2"
      >
        🗺️ {showMap ? "지도 닫기" : "지도에서 위치 선택"}
      </button>
      {showMap && (
        <MapPicker
          initial={picked}
          onPick={({ lat, lng, address: addr }) => {
            setPicked({ lat, lng });
            if (addr) setAddress(addr);
          }}
        />
      )}
      {picked && (
        <p className="text-xs text-green-600">
          ✓ 지도에서 위치 선택됨 (이 좌표로 등록돼요)
        </p>
      )}
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
        className="rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink active:bg-blue-800 disabled:bg-gray-300"
      >
        {busy ? "등록 중…" : "가게 등록"}
      </button>

      {needLogin && (
        <p className="text-center text-sm text-ink-3">
          로그인이 필요해요.{" "}
          <Link href="/login" className="font-medium text-brand">
            로그인하러 가기
          </Link>
        </p>
      )}
      {msg && <p className="text-center text-sm text-red-500">{msg}</p>}
    </div>
  );
}
