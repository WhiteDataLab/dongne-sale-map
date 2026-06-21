"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GIFT_CATEGORIES } from "@/lib/gifts";

type Gift = {
  id: string;
  brand: string;
  name: string;
  category: string | null;
  points: number;
  imageUrl: string | null;
  emoji: string;
  color: string;
  active: boolean;
  sortOrder: number;
  costKrw: number | null; // M5: 제휴 매입 원가
  faceValueKrw: number | null; // M5: 액면가
  partner: string | null; // M5: 제휴사
};

const inputCls = "w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-blue-500";

async function uploadImage(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const d = (await res.json().catch(() => ({}))) as { url?: string };
  return res.ok && d.url ? d.url : null;
}

function GiftRow({ item }: { item: Gift }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [brand, setBrand] = useState(item.brand);
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category ?? "");
  const [points, setPoints] = useState(String(item.points));
  const [emoji, setEmoji] = useState(item.emoji);
  const [color, setColor] = useState(item.color);
  const [imageUrl, setImageUrl] = useState<string | null>(item.imageUrl);
  const [active, setActive] = useState(item.active);
  const [sortOrder, setSortOrder] = useState(String(item.sortOrder));
  const [costKrw, setCostKrw] = useState(item.costKrw != null ? String(item.costKrw) : "");
  const [faceValueKrw, setFaceValueKrw] = useState(item.faceValueKrw != null ? String(item.faceValueKrw) : "");
  const [partner, setPartner] = useState(item.partner ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/gifts/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand,
        name,
        category: category.trim() || null,
        points: Number(points),
        emoji,
        color,
        imageUrl,
        active,
        sortOrder: Number(sortOrder),
        costKrw: costKrw.trim() ? Number(costKrw) : null,
        faceValueKrw: faceValueKrw.trim() ? Number(faceValueKrw) : null,
        partner: partner.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("저장됨");
      router.refresh();
    } else {
      const e = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(e.error ?? "저장 실패");
    }
  };

  const del = async () => {
    if (!window.confirm(`'${brand} ${name}' 상품을 삭제할까요?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/gifts/${item.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
    else setMsg("삭제 실패");
  };

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg text-2xl"
          style={{ background: `${color}1a` }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            emoji
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/50 text-[9px] text-white">사진</span>
        </button>
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="브랜드" className={inputCls} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="상품명" className={inputCls} />
          <input list="gift-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="분류(예: 커피·음료)" className={`${inputCls} col-span-2`} />
          <input value={points} onChange={(e) => setPoints(e.target.value)} inputMode="numeric" placeholder="포인트" className={inputCls} />
          <div className="flex gap-1.5">
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="이모지" className={`${inputCls} w-14`} />
            <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" placeholder="순서" className={inputCls} />
          </div>
        </div>
      </div>
      {/* M5: 제휴 정산 필드 — 원가/액면가/제휴사 */}
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <input value={costKrw} onChange={(e) => setCostKrw(e.target.value)} inputMode="numeric" placeholder="원가(매입)" className={inputCls} />
        <input value={faceValueKrw} onChange={(e) => setFaceValueKrw(e.target.value)} inputMode="numeric" placeholder="액면가" className={inputCls} />
        <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="제휴사" className={inputCls} />
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          const url = await uploadImage(f);
          setBusy(false);
          if (url) setImageUrl(url);
          else setMsg("이미지 업로드 실패");
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-1 text-xs text-ink-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> 노출
        </label>
        <div className="flex items-center gap-2">
          {imageUrl && (
            <button type="button" onClick={() => setImageUrl(null)} className="text-xs text-ink-3">
              이미지 제거
            </button>
          )}
          {msg && <span className="text-xs text-ink-3">{msg}</span>}
          <button type="button" onClick={del} disabled={busy} className="rounded-lg border border-line px-2.5 py-1 text-xs text-red-500">
            삭제
          </button>
          <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white disabled:bg-gray-300">
            {busy ? "처리 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddGift() {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [points, setPoints] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const add = async () => {
    if (!brand.trim() || !name.trim() || !Number(points)) return setMsg("브랜드·상품명·포인트를 입력하세요.");
    setBusy(true);
    const res = await fetch("/api/admin/gifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand, name, category: category.trim() || null, points: Number(points) }),
    });
    setBusy(false);
    if (res.ok) {
      setBrand("");
      setName("");
      setCategory("");
      setPoints("");
      setMsg(null);
      router.refresh();
    } else {
      const e = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(e.error ?? "추가 실패");
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-blue-300 p-3">
      <p className="mb-2 text-sm font-semibold text-brand-ink">＋ 상품 추가</p>
      <p className="mb-2 text-xs text-ink-3">커피뿐 아니라 올리브영·아웃백·디저트 등 어떤 기프티콘이든 추가할 수 있어요. 분류를 정하면 포인트샵에서 그룹으로 묶여 보여요.</p>
      <div className="grid grid-cols-2 gap-1.5">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="브랜드(예: 올리브영)" className={inputCls} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="상품명(예: 1만원권)" className={inputCls} />
        <input list="gift-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="분류(예: 뷰티·드럭스토어)" className={inputCls} />
        <input value={points} onChange={(e) => setPoints(e.target.value)} inputMode="numeric" placeholder="포인트(=원)" className={inputCls} />
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {msg && <span className="text-xs text-red-500">{msg}</span>}
        <button type="button" onClick={add} disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300">
          추가 (추가 후 사진·이모지 편집)
        </button>
      </div>
    </div>
  );
}

export function GiftAdmin({ items }: { items: Gift[] }) {
  return (
    <div className="flex flex-col gap-3">
      {/* 분류 프리셋 — 입력칸에서 선택하거나 직접 입력 */}
      <datalist id="gift-categories">
        {GIFT_CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <AddGift />
      {items.map((g) => (
        <GiftRow key={g.id} item={g} />
      ))}
    </div>
  );
}
