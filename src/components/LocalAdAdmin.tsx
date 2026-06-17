"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALAD_CATEGORIES, type LocalAdRow } from "@/lib/localAds";

const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
  active: { txt: "노출 중", cls: "bg-green-100 text-green-700" },
  paused: { txt: "일시중지", cls: "bg-gray-200 text-gray-600" },
  ended: { txt: "종료", cls: "bg-gray-100 text-gray-400" },
};

/** L4 — 지역 광고 관리(관리자 대행 등록). 생성 + 상태 제어 + 클릭 리포트. */
export function LocalAdAdmin({ ads }: { ads: LocalAdRow[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [advertiser, setAdvertiser] = useState("");
  const [category, setCategory] = useState<string>(LOCALAD_CATEGORIES[0]);
  const [region, setRegion] = useState("이문동");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [priceKrw, setPriceKrw] = useState(50000);
  const [days, setDays] = useState(30);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) setImageUrl(((await res.json()) as { url: string }).url);
      else setMsg("이미지 업로드 실패");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!advertiser.trim() || !title.trim() || !body.trim() || !region.trim()) {
      setMsg("광고주·제목·내용·동네는 필수예요.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/local-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advertiser, category, region, title, body, linkUrl, priceKrw, days, imageUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "생성 실패");
        return;
      }
      setAdvertiser("");
      setTitle("");
      setBody("");
      setLinkUrl("");
      setImageUrl(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const op = async (id: string, operation: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/local-ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, op: operation }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const live = ads.filter((a) => a.status === "active");
  const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
  const totalRevenue = live.reduce((s, a) => s + a.priceKrw, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-indigo-50 p-3">
          <p className="text-[11px] text-gray-400">노출 중</p>
          <p className="text-lg font-bold text-indigo-700">{live.length}</p>
        </div>
        <div className="rounded-xl bg-green-50 p-3">
          <p className="text-[11px] text-gray-400">월 광고매출(정액)</p>
          <p className="text-lg font-bold text-green-700">{totalRevenue.toLocaleString("ko-KR")}원</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-[11px] text-gray-400">총 클릭</p>
          <p className="text-lg font-bold text-amber-700">{totalClicks.toLocaleString("ko-KR")}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-3">
        <p className="mb-2 text-sm font-bold">+ 지역 광고 등록</p>
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <input value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} placeholder="광고주명" className="rounded-md border border-gray-200 px-2.5 py-2 text-sm" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-gray-200 px-2 py-2 text-sm">
              {LOCALAD_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="타깃 동네 (예: 이문동)" className="rounded-md border border-gray-200 px-2.5 py-2 text-sm" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="제목" className="rounded-md border border-gray-200 px-2.5 py-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={200} placeholder="내용" className="resize-none rounded-md border border-gray-200 px-2.5 py-2 text-sm" />
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="링크 URL (선택, http/https)" className="rounded-md border border-gray-200 px-2.5 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-1.5">
            <label className="text-[11px] text-gray-500">정액 광고비(월)
              <input type="number" value={priceKrw} onChange={(e) => setPriceKrw(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-[11px] text-gray-500">노출 기간(일)
              <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600">
              {imageUrl ? "이미지 변경" : "이미지 추가(선택)"}
            </button>
            {imageUrl && <span className="text-[11px] text-green-600">✓ 첨부됨</span>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </div>
          <button type="button" disabled={busy} onClick={create} className="mt-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "처리 중…" : "광고 등록"}
          </button>
          {msg && <p className="text-xs text-red-500">{msg}</p>}
        </div>
      </div>

      {ads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">아직 등록된 지역 광고가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ads.map((a) => {
            const s = STATUS_LABEL[a.status] ?? { txt: a.status, cls: "bg-gray-100 text-gray-500" };
            return (
              <li key={a.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-bold">{a.advertiser} <span className="font-normal text-gray-400">· {a.category} · {a.region}</span></p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.txt}</span>
                </div>
                <p className="mt-0.5 text-sm">{a.title}</p>
                <p className="text-xs text-gray-500">{a.body}</p>
                <p className="mt-1 text-[11px] text-gray-400">월 {a.priceKrw.toLocaleString("ko-KR")}원 · 클릭 {a.clicks} · ~{a.endsAt ? new Date(a.endsAt).toLocaleDateString("ko-KR") : "무기한"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.status === "active" && <button type="button" disabled={busy} onClick={() => op(a.id, "pause")} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-600">일시중지</button>}
                  {a.status === "paused" && <button type="button" disabled={busy} onClick={() => op(a.id, "resume")} className="rounded-lg border border-indigo-300 px-2.5 py-1 text-xs text-indigo-600">재개</button>}
                  {a.status !== "ended" && <button type="button" disabled={busy} onClick={() => op(a.id, "end")} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-500">종료</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
