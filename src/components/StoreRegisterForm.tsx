"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/constants";

/**
 * 인라인 가게 등록 폼 (메인 지도에서 좌표를 찍은 뒤 뜨는 바텀 패널).
 * 좌표(point)는 지도 탭으로 이미 정해졌고 주소는 역지오코딩으로 prefill.
 */
export function StoreRegisterForm({
  point,
  onDone,
  onCancel,
  onToast,
}: {
  point: { lat: number; lng: number; address: string };
  onDone: () => void;
  onCancel: () => void;
  onToast: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("vegetable");
  const [address, setAddress] = useState(point.address);
  const [phone, setPhone] = useState("");

  // 지도에서 다른 좌표를 다시 찍으면 주소를 새 역지오코딩 결과로 갱신.
  // (좌표가 바뀔 때만 덮어쓰므로 사용자가 직접 수정한 내용은 같은 위치에선 유지됨)
  const coordKey = `${point.lat},${point.lng}`;
  const prevCoordRef = useRef(coordKey);
  useEffect(() => {
    if (prevCoordRef.current !== coordKey) {
      prevCoordRef.current = coordKey;
      setAddress(point.address);
    }
  }, [coordKey, point.address]);
  const [description, setDescription] = useState("");
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return onToast("가게명을 입력해 주세요.");
    setBusy(true);
    setNeedLogin(false);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          address: address.trim() || "지도에서 선택한 위치",
          phone,
          description,
          lat: point.lat,
          lng: point.lng,
        }),
      });
      if (res.status === 401) {
        setNeedLogin(true);
        return;
      }
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        return onToast(e.error ?? "등록에 실패했어요.");
      }
      onToast("가게가 등록됐어요! 검토 후 인증돼요.");
      onDone();
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500";

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 max-h-[72%] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl">
      <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-gray-300" />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">이 위치에 가게 등록</h2>
        <button type="button" onClick={onCancel} className="text-sm text-gray-400">
          취소
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        선택한 좌표: {point.lat.toFixed(5)}, {point.lng.toFixed(5)} · 위치를 바꾸려면 지도를 다시 누르세요.
      </p>

      <div className="mt-3 flex flex-col gap-3">
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
          placeholder="주소 (자동 입력됨, 수정 가능)"
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
          rows={2}
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
      </div>
    </div>
  );
}
