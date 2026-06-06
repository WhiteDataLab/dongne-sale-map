"use client";

import { useRef, useState } from "react";
import type { ProductDTO } from "@/lib/types";
import { categoryHasQuantity, type Category } from "@/lib/constants";
import { PhotoEditor } from "./PhotoEditor";

/** 메뉴(상품) 추가/수정 폼 (스펙 Phase 7b). 신규 등록 시 사진 필수. */
export function ProductForm({
  storeId,
  category,
  product,
  onDone,
  onCancel,
  onToast,
}: {
  storeId: string;
  category: Category;
  product?: ProductDTO;
  onDone: () => void;
  onCancel: () => void;
  onToast: (msg: string) => void;
}) {
  const hasQty = categoryHasQuantity(category);
  const editing = Boolean(product);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(product?.photoUrl ?? null);
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [qtyUnit, setQtyUnit] = useState(product?.qtyUnit ?? "");
  const [origin, setOrigin] = useState(product?.origin ?? "");
  const [busy, setBusy] = useState(false);
  const [photoEditing, setPhotoEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!name.trim()) return onToast("메뉴명을 입력해 주세요.");
    if (hasQty && !qtyUnit.trim()) return onToast("단위(예: 1kg)를 입력해 주세요.");
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) return onToast("가격을 확인해 주세요.");
    if (!editing && !file) return onToast("메뉴 사진은 필수예요.");

    setBusy(true);
    try {
      let photoUrl = product?.photoUrl ?? undefined;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (!up.ok) {
          const e = (await up.json().catch(() => ({}))) as { error?: string };
          onToast(up.status === 401 ? "로그인이 필요해요." : e.error ?? "사진 업로드 실패");
          return;
        }
        photoUrl = ((await up.json()) as { url: string }).url;
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        price: p,
        qtyUnit: qtyUnit.trim(),
        origin: origin.trim() || null,
      };
      let res: Response;
      if (editing && product) {
        if (photoUrl !== undefined) payload.photoUrl = photoUrl;
        res = await fetch(`/api/products/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.storeId = storeId;
        payload.photoUrl = photoUrl;
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        onToast(
          res.status === 401
            ? "로그인이 필요해요."
            : res.status === 403
              ? "메뉴를 관리할 권한이 없어요."
              : e.error ?? "처리에 실패했어요.",
        );
        return;
      }
      if (editing) {
        onToast("메뉴를 수정했어요.");
      } else {
        const { pointPending } = (await res.json().catch(() => ({}))) as { pointPending?: number };
        onToast(
          pointPending && pointPending > 0
            ? `메뉴를 등록했어요! 적립 대기 +${pointPending}P`
            : "메뉴를 추가했어요.",
        );
      }
      onDone();
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{editing ? "메뉴 수정" : "메뉴 추가"}</h4>
        <button type="button" onClick={onCancel} className="text-sm text-gray-400">
          닫기
        </button>
      </div>

      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex h-28 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-gray-400">📷 사진 {editing ? "변경" : "추가(필수)"}</span>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          if (f) {
            setPreview(URL.createObjectURL(f));
            setPhotoEditing(true); // 선택 즉시 편집모드 진입
          }
        }}
      />
      {file && (
        <button
          type="button"
          onClick={() => setPhotoEditing(true)}
          className="self-start text-xs font-medium text-blue-600"
        >
          ✏️ 사진 편집 (자르기/펜)
        </button>
      )}
      {photoEditing && file && (
        <PhotoEditor
          file={file}
          onSave={(f) => {
            setFile(f);
            setPreview(URL.createObjectURL(f));
            setPhotoEditing(false);
          }}
          onCancel={() => setPhotoEditing(false)}
        />
      )}

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={hasQty ? "메뉴명 (예: 사과 부사)" : "메뉴/서비스명 (예: 커트, 드라이클리닝)"}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="numeric"
          placeholder="가격(원)"
          className={`${hasQty ? "w-1/2" : "w-full"} rounded-lg border border-gray-200 px-3 py-2 text-sm`}
        />
        {hasQty && (
          <input
            value={qtyUnit}
            onChange={(e) => setQtyUnit(e.target.value)}
            placeholder="단위 (예: 5개, 1kg)"
            className="w-1/2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        )}
      </div>
      {hasQty && (
        <input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="원산지 (선택)"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
      >
        {busy ? "저장 중…" : editing ? "메뉴 수정" : "메뉴 추가"}
      </button>
    </div>
  );
}
