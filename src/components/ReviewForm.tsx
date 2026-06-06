"use client";

import { useRef, useState } from "react";
import type { ProductDTO } from "@/lib/types";
import { PhotoEditor } from "./PhotoEditor";

/** 버튼/태깅 리뷰 프리셋. 누르면 선택되고, 여러 개 선택 가능. */
const REVIEW_TAGS = [
  "재료가 신선해요",
  "양이 많아요",
  "가성비가 좋아요",
  "메뉴 구성이 알차요",
  "고기 질이 좋아요",
  "비싼 만큼 가치있어요",
  "인테리어가 멋져요",
];

const MAX_PHOTOS = 5;

/** 리뷰 작성 폼 (태깅 + 사진 + 포인트 정책). */
export function ReviewForm({
  storeId,
  products,
  onGoRegisterProduct,
  onDone,
  onCancel,
  onToast,
}: {
  storeId: string;
  products: ProductDTO[];
  onGoRegisterProduct: () => void;
  onDone: () => void;
  onCancel: () => void;
  onToast: (msg: string) => void;
}) {
  const [purchasedId, setPurchasedId] = useState<string | null>(null);
  const [notInMenu, setNotInMenu] = useState(false);
  const [rating, setRating] = useState(5);
  const [selected, setSelected] = useState<string[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = (tag: string) =>
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const buildContent = () => {
    const parts = [...selected];
    if (showCustom && custom.trim()) parts.push(custom.trim());
    return parts.join(", ");
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_PHOTOS - files.length;
    if (room <= 0) return onToast(`사진은 최대 ${MAX_PHOTOS}장이에요.`);
    const picked = Array.from(list).slice(0, room);
    const firstNew = files.length;
    setFiles((f) => [...f, ...picked]);
    setPreviews((p) => [...p, ...picked.map((f) => URL.createObjectURL(f))]);
    setEditIdx(firstNew);
  };
  const replaceAt = (i: number, f: File) => {
    setFiles((arr) => arr.map((x, idx) => (idx === i ? f : x)));
    setPreviews((arr) => {
      URL.revokeObjectURL(arr[i]);
      return arr.map((x, idx) => (idx === i ? URL.createObjectURL(f) : x));
    });
  };
  const removeAt = (i: number) => {
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setPreviews((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, idx) => idx !== i);
    });
  };

  const submit = async () => {
    const content = buildContent();
    if (!content) return onToast("태그를 고르거나 ‘기타’로 직접 입력해 주세요.");
    setSubmitting(true);
    try {
      // 사진 업로드(개별)
      const photoUrls: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (!up.ok) {
          const e = (await up.json().catch(() => ({}))) as { error?: string };
          onToast(up.status === 401 ? "로그인이 필요해요." : e.error ?? "사진 업로드 실패");
          return;
        }
        const { url } = (await up.json()) as { url: string };
        photoUrls.push(url);
      }

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, rating, content, photoUrls }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        onToast(res.status === 401 ? "로그인이 필요해요." : e.error ?? "등록 실패");
        return;
      }
      const { pointPending } = (await res.json()) as { pointPending?: number };
      onToast(
        pointPending && pointPending > 0
          ? `리뷰 등록! 적립 대기 +${pointPending}P`
          : "리뷰 등록 완료! 다음부터는 사진을 함께 올리면 10P 받아요.",
      );
      onDone();
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">리뷰 쓰기</h4>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-2.5 py-1 text-sm text-gray-500 hover:bg-gray-50"
        >
          닫기
        </button>
      </div>

      {/* 구매 메뉴 선택 ("어떤 걸 구매하셨나요?") */}
      <div>
        <p className="mb-1.5 text-sm font-medium">어떤 걸 구매하셨나요?</p>
        <div className="flex flex-wrap gap-2">
          {products.map((p) => {
            const on = purchasedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPurchasedId(on ? null : p.id);
                  setNotInMenu(false);
                }}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  on
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                {p.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setNotInMenu(true);
              setPurchasedId(null);
            }}
            className={[
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              notInMenu
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-dashed border-gray-300 bg-white text-gray-500 hover:bg-gray-50",
            ].join(" ")}
          >
            메뉴에 없어요
          </button>
        </div>

        {notInMenu && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800">상품부터 등록하시겠어요?</p>
            <p className="mt-0.5 text-xs text-amber-700">
              구매하신 메뉴를 먼저 등록하면 <b>추가 포인트(+5P)</b>를 받을 수 있어요. 등록 후 다시 리뷰를 쓰면 리뷰 포인트도 받아요!
            </p>
            <button
              type="button"
              onClick={onGoRegisterProduct}
              className="mt-2 w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              ＋ 상품 등록하러 가기
            </button>
          </div>
        )}
      </div>

      {/* 별점 */}
      <div className="flex gap-1 text-2xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n}점`}
            onClick={() => setRating(n)}
            className={n <= rating ? "text-amber-500" : "text-gray-300"}
          >
            ★
          </button>
        ))}
      </div>

      {/* 태그 버튼 */}
      <div className="flex flex-wrap gap-2">
        {REVIEW_TAGS.map((tag) => {
          const on = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                on
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {tag}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={[
            "rounded-full border px-3 py-1.5 text-sm transition-colors",
            showCustom
              ? "border-gray-800 bg-gray-800 text-white"
              : "border-dashed border-gray-300 bg-white text-gray-500 hover:bg-gray-50",
          ].join(" ")}
        >
          ✏️ 기타
        </button>
      </div>

      {showCustom && (
        <textarea
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          rows={2}
          autoFocus
          placeholder="직접 남기고 싶은 후기를 적어 주세요."
          className="resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
      )}

      {/* 사진 (선택, 최대 5장) */}
      <div className="grid grid-cols-4 gap-2">
        {previews.map((src, i) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="삭제"
              className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => setEditIdx(i)}
              className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white"
            >
              편집
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-[10px] text-gray-400"
          >
            <span className="text-lg">📷</span>
            사진
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        💡 첫 리뷰는 글만 써도 10P! 그 다음부터는 <b>사진과 함께</b> 작성하면 10P를 받아요.
      </p>

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:bg-gray-300"
      >
        {submitting ? "등록 중…" : "리뷰 등록"}
      </button>

      {editIdx !== null && files[editIdx] && (
        <PhotoEditor
          file={files[editIdx]}
          onSave={(f) => {
            replaceAt(editIdx, f);
            setEditIdx(null);
          }}
          onCancel={() => setEditIdx(null)}
        />
      )}
    </div>
  );
}
