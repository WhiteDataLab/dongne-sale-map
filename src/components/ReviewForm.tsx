"use client";

import { useRef, useState } from "react";
import type { ReviewDTO } from "@/lib/types";
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

/** 폼이 쓰는 최소 상품 정보(이름·id). 가게 상세=ProductDTO, 마이페이지=연결된 메뉴. */
type PickableProduct = { id: string; name: string };

/**
 * 리뷰 작성/수정 폼.
 * 규칙:
 *  - 구매 메뉴 1개 이상 연결 필수(다중 선택).
 *  - 태그(빠른 선택)는 원형 칩, '기타'로 직접 입력하면 일반 텍스트로 함께 저장.
 *  - `review` 가 주어지면 수정 모드(PATCH), 아니면 작성 모드(POST).
 */
export function ReviewForm({
  storeId,
  products = [],
  review,
  reviewPoint = 10,
  productPoint = 5,
  onGoRegisterProduct,
  onDone,
  onCancel,
  onToast,
}: {
  storeId: string;
  products?: PickableProduct[];
  review?: ReviewDTO;
  reviewPoint?: number;
  productPoint?: number;
  onGoRegisterProduct?: () => void;
  onDone: () => void;
  onCancel: () => void;
  onToast: (msg: string) => void;
}) {
  const isEdit = Boolean(review);
  const [purchasedIds, setPurchasedIds] = useState<string[]>(
    review?.products.map((p) => p.id) ?? [],
  );
  const [notInMenu, setNotInMenu] = useState(false);
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [selected, setSelected] = useState<string[]>(review?.tags ?? []);
  const [showCustom, setShowCustom] = useState(Boolean(review?.content));
  const [custom, setCustom] = useState(review?.content ?? "");
  // 수정 모드에서 유지 중인 기존(원격) 사진 URL
  const [keptUrls, setKeptUrls] = useState<string[]>(review?.photoUrls ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // 영수증 인증(선택) — 비공개 업로드 후 경로만 보관
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const receiptRef = useRef<HTMLInputElement>(null);

  const uploadReceipt = async (f: File) => {
    setReceiptBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload/receipt", { method: "POST", body: fd });
      if (!res.ok) {
        onToast(res.status === 401 ? "로그인이 필요해요." : "영수증 업로드에 실패했어요.");
        return;
      }
      const { path } = (await res.json()) as { path: string };
      setReceiptPath(path);
      setReceiptPreview(URL.createObjectURL(f));
      onToast("영수증 인증이 추가됐어요.");
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setReceiptBusy(false);
    }
  };

  const toggleTag = (tag: string) =>
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  const toggleProduct = (id: string) =>
    setPurchasedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const content = showCustom ? custom.trim() : "";
  const photoCount = keptUrls.length + files.length;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_PHOTOS - photoCount;
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
    if (purchasedIds.length === 0) {
      return onToast("구매하신 메뉴를 1개 이상 선택해 주세요.");
    }
    if (selected.length === 0 && !content) {
      return onToast("태그를 고르거나 ‘기타’로 직접 입력해 주세요.");
    }
    setSubmitting(true);
    try {
      // 새로 추가한 사진만 업로드(수정 모드의 기존 사진은 그대로 유지)
      const uploaded: string[] = [];
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
        uploaded.push(url);
      }
      const photoUrls = [...keptUrls, ...uploaded];
      const payload = {
        rating,
        content,
        tags: selected,
        productIds: purchasedIds,
        photoUrls,
        ...(receiptPath ? { receiptPath } : {}),
      };

      if (isEdit && review) {
        const res = await fetch(`/api/reviews/${review.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const e = (await res.json().catch(() => ({}))) as { error?: string };
          onToast(
            res.status === 401
              ? "로그인이 필요해요."
              : res.status === 403
                ? "수정할 권한이 없어요."
                : e.error ?? "수정 실패",
          );
          return;
        }
        onToast("리뷰를 수정했어요.");
        onDone();
        return;
      }

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, ...payload }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        onToast(res.status === 401 ? "로그인이 필요해요." : e.error ?? "등록 실패");
        return;
      }
      const { pointPending, scored } = (await res.json()) as {
        pointPending?: number;
        scored?: boolean;
      };
      onToast(
        pointPending && pointPending > 0
          ? `리뷰 등록! 적립 대기 +${pointPending}P`
          : scored === false
            ? "리뷰 등록 완료! 오늘 이미 작성해 별점·포인트는 반영되지 않아요."
            : `리뷰 등록 완료! 다음부터는 사진을 함께 올리면 ${reviewPoint}P 받아요.`,
      );
      onDone();
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{isEdit ? "리뷰 수정" : "리뷰 쓰기"}</h4>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line px-2.5 py-1 text-sm text-ink-3 hover:bg-surface-2"
        >
          닫기
        </button>
      </div>

      {/* 구매 메뉴 선택 — 1개 이상 필수, 다중 선택 가능 */}
      <div>
        <p className="mb-1.5 text-sm font-medium">
          어떤 걸 구매하셨나요? <span className="text-red-500">*</span>
          <span className="ml-1 text-xs font-normal text-ink-3">여러 개 선택 가능</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {products.map((p) => {
            const on = purchasedIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  toggleProduct(p.id);
                  setNotInMenu(false);
                }}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  on
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-ink-2 hover:bg-surface-2",
                ].join(" ")}
              >
                {on ? "✓ " : ""}
                {p.name}
              </button>
            );
          })}
          {!isEdit && onGoRegisterProduct && (
            <button
              type="button"
              onClick={() => setNotInMenu((v) => !v)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                notInMenu
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-dashed border-line bg-white text-ink-3 hover:bg-surface-2",
              ].join(" ")}
            >
              메뉴에 없어요
            </button>
          )}
        </div>
        {products.length === 0 && !notInMenu && (
          <p className="mt-1 text-xs text-ink-3">
            아직 등록된 메뉴가 없어요. 구매하신 메뉴를 먼저 등록해 주세요.
          </p>
        )}

        {notInMenu && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800">상품부터 등록하시겠어요?</p>
            <p className="mt-0.5 text-xs text-amber-700">
              구매하신 메뉴를 먼저 등록하면 <b>추가 포인트(+{productPoint}P)</b>를 받을 수 있어요. 등록 후 다시 리뷰를 쓰면 리뷰 포인트도 받아요!
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
      <div className="flex gap-0.5 text-2xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n}점`}
            onClick={() => setRating(n)}
            className={`flex size-11 items-center justify-center ${n <= rating ? "text-amber-500" : "text-ink-4"}`}
          >
            ★
          </button>
        ))}
      </div>

      {/* 태그 버튼 (빠른 선택) + 기타(직접 입력) */}
      <div className="flex flex-wrap gap-2">
        {REVIEW_TAGS.map((tag) => {
          const on = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                on
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-ink-2 hover:bg-surface-2",
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
              : "border-dashed border-line bg-white text-ink-3 hover:bg-surface-2",
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
          className="resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      )}

      {/* 사진 (선택, 최대 5장) */}
      <div className="grid grid-cols-4 gap-2">
        {/* 기존 사진(수정 모드): 삭제만 가능 */}
        {keptUrls.map((url) => (
          <div key={url} className="relative aspect-square overflow-hidden rounded-lg bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setKeptUrls((arr) => arr.filter((u) => u !== url))}
              aria-label="삭제"
              className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
            >
              ×
            </button>
          </div>
        ))}
        {previews.map((src, i) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-lg bg-surface-2">
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
        {photoCount < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-line bg-white text-[10px] text-ink-3"
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

      {/* 영수증 인증 (선택) — 비공개 보관, 배지로만 표시 */}
      <div className="rounded-lg border border-line bg-white p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              🧾 영수증 인증 <span className="text-xs font-normal text-ink-3">(선택)</span>
            </p>
            <p className="text-xs text-ink-3">올리면 ‘영수증 인증’ 배지가 붙어요. 이미지는 비공개로 보관돼요.</p>
          </div>
          <button
            type="button"
            onClick={() => receiptRef.current?.click()}
            disabled={receiptBusy}
            className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2 disabled:text-ink-4"
          >
            {receiptBusy ? "업로드 중…" : receiptPath ? "다시 선택" : "영수증 올리기"}
          </button>
        </div>
        {(receiptPath || (isEdit && review?.receiptVerified)) && (
          <p className="mt-1 text-xs font-medium text-brand">
            ✓ {receiptPath ? "영수증 인증 추가됨" : "기존 영수증 인증됨"}
          </p>
        )}
        {receiptPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={receiptPreview} alt="" className="mt-2 h-20 rounded border border-line object-cover" />
        )}
        <input
          ref={receiptRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadReceipt(f);
            e.target.value = "";
          }}
        />
      </div>

      {!isEdit && (
        <p className="rounded-lg bg-brand-wash px-3 py-2 text-xs text-brand-ink">
          💡 첫 리뷰는 글만 써도 {reviewPoint}P! 그 다음부터는 <b>사진과 함께</b> 작성하면 {reviewPoint}P를 받아요. (같은 날 같은 가게 재작성은 별점·포인트 미반영)
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="min-h-[52px] rounded-lg bg-brand py-2.5 text-[15px] font-bold text-white disabled:bg-ink-4"
      >
        {submitting ? (isEdit ? "수정 중…" : "등록 중…") : isEdit ? "수정 완료" : "리뷰 등록"}
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
