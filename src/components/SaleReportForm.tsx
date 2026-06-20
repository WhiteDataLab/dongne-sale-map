"use client";

import { useRef, useState } from "react";
import { won } from "@/lib/format";
import type { ProductDTO } from "@/lib/types";
import { categoryHasQuantity, type Category } from "@/lib/constants";
import { PhotoEditor } from "./PhotoEditor";

type ExpiresOption = "1h" | "2h" | "close" | "custom";
const MAX_PHOTOS = 10;

/** "HH:mm"(오늘) → ISO. 이미 지난 시각이면 내일로 간주. */
function buildCustomISO(hhmm: string): string | null {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/**
 * 세일 제보 폼 (Phase 3 + Phase 6 확장).
 * 사진 최대 10장 → /api/upload(개별) → photoUrls → /api/sales.
 * 만료: 1h/2h/마감까지/직접 설정(시간 선택).
 */
export function SaleReportForm({
  storeId,
  category,
  products,
  onDone,
  onCancel,
  onToast,
  canNotify = false,
}: {
  storeId: string;
  category: Category;
  products: ProductDTO[];
  onDone: () => void;
  onCancel: () => void;
  onToast: (msg: string) => void;
  canNotify?: boolean; // M12: 사장님(라이트+) — 등록 시 즐겨찾기 손님 알림 토글 노출
}) {
  const hasQty = categoryHasQuantity(category);
  const [notify, setNotify] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [salePrice, setSalePrice] = useState("");
  const [qty, setQty] = useState("");
  const [expires, setExpires] = useState<ExpiresOption>("close");
  const [customTime, setCustomTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dup, setDup] = useState<{ saleId: string } | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const replaceAt = (i: number, f: File) => {
    setFiles((arr) => arr.map((x, idx) => (idx === i ? f : x)));
    setPreviews((arr) => {
      URL.revokeObjectURL(arr[i]);
      return arr.map((x, idx) => (idx === i ? URL.createObjectURL(f) : x));
    });
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const room = MAX_PHOTOS - files.length;
    if (room <= 0) return onToast(`사진은 최대 ${MAX_PHOTOS}장이에요.`);
    const picked = incoming.slice(0, room);
    const firstNew = files.length; // 추가된 첫 사진 인덱스
    setFiles((f) => [...f, ...picked]);
    setPreviews((p) => [...p, ...picked.map((f) => URL.createObjectURL(f))]);
    setEditIdx(firstNew); // 선택 즉시 편집모드 진입
  };

  const removeAt = (i: number) => {
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setPreviews((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, idx) => idx !== i);
    });
  };

  const submitCorrection = async () => {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "sale",
        targetId: dup?.saleId,
        reason: `정정 제보: ${title || "세일 정보가 달라요"}`,
      }),
    });
    if (res.ok) {
      onToast("정정 제보가 접수됐어요. 검토 후 반영돼요.");
      onDone();
    } else {
      onToast(res.status === 401 ? "로그인이 필요해요." : "접수에 실패했어요.");
    }
  };

  const submit = async () => {
    if (files.length === 0) return onToast("사진은 1장 이상 필요해요.");
    if (!title.trim()) return onToast("세일/행사 내용을 입력해 주세요.");
    if (hasQty && !qty.trim()) return onToast("수량을 입력해 주세요.");
    const price = Number(salePrice);
    if (!Number.isFinite(price) || price < 0) return onToast("세일가를 확인해 주세요.");

    let expiresAt: string | undefined;
    if (expires === "custom") {
      const iso = buildCustomISO(customTime);
      if (!iso) return onToast("마감 시간을 선택해 주세요.");
      expiresAt = iso;
    }

    setSubmitting(true);
    setDup(null);
    try {
      // 1) 사진 업로드 (개별, 순차)
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

      // 2) 세일 등록
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          productId: productId || null,
          title: title.trim(),
          salePrice: price,
          qty: qty.trim(),
          expiresOption: expires,
          expiresAt,
          photoUrls,
        }),
      });

      if (res.status === 409) {
        const d = (await res.json()) as { saleId?: string };
        setDup({ saleId: d.saleId ?? "" });
        return;
      }
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        onToast(res.status === 401 ? "로그인이 필요해요." : e.error ?? "제보 등록 실패");
        return;
      }
      const { pointGranted, saleId } = (await res.json()) as { pointGranted?: number; saleId?: string };

      // M12: 사장님이 알림 토글을 켰으면 즐겨찾기 손님에게 세일 알림 발송(라이트+ 게이팅은 서버가 처리).
      if (canNotify && notify && saleId) {
        try {
          const al = await fetch(`/api/stores/${storeId}/alerts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "sale",
              saleId,
              title: title.trim().slice(0, 60),
              body: `${won(price)}${qty.trim() ? ` · ${qty.trim()}` : ""} 세일이 떴어요!`,
            }),
          });
          const aj = (await al.json().catch(() => ({}))) as { error?: string; favoriteCount?: number };
          if (al.ok) {
            onToast(`세일 제보 완료! +${pointGranted ?? 0}P · 단골 ${aj.favoriteCount ?? 0}명에게 알림 발송`);
          } else {
            onToast(`세일 제보 완료! +${pointGranted ?? 0}P (알림 미발송: ${aj.error ?? "한도/권한"})`);
          }
          onDone();
          return;
        } catch {
          /* 알림 실패해도 제보는 성공 */
        }
      }
      onToast(`세일 제보 완료! +${pointGranted ?? 0}P 적립됐어요`);
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
        <h4 className="font-semibold">세일 제보하기</h4>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line px-2.5 py-1 text-sm text-ink-3 hover:bg-surface-2"
        >
          닫기
        </button>
      </div>

      {/* 사진들 (최대 10장) */}
      <div className="grid grid-cols-3 gap-2">
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
              className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
            >
              ✏️ 편집
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-line bg-white text-xs text-ink-3"
          >
            <span className="text-lg">📷</span>
            {files.length === 0 ? "사진 추가" : `${files.length}/${MAX_PHOTOS}`}
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
          e.target.value = ""; // 같은 파일 재선택 허용
        }}
      />

      {products.length > 0 && (
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
        >
          <option value="">상품 연결 안 함</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({won(p.price)})
            </option>
          ))}
        </select>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={hasQty ? "세일 내용 (예: 딸기 1박스 떨이)" : "세일/행사 내용 (예: 이번 주 펌 20% 할인)"}
        className="rounded-lg border border-line px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          inputMode="numeric"
          placeholder="세일가(원)"
          className={`${hasQty ? "w-1/2" : "w-full"} rounded-lg border border-line px-3 py-2 text-sm`}
        />
        {hasQty && (
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="수량 (예: 1박스)"
            className="w-1/2 rounded-lg border border-line px-3 py-2 text-sm"
          />
        )}
      </div>

      {/* 만료 */}
      <div className="flex flex-wrap gap-2 text-sm">
        {(["1h", "2h", "close", "custom"] as ExpiresOption[]).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setExpires(o)}
            className={[
              "rounded-lg border px-3 py-2",
              expires === o
                ? "border-brand bg-brand text-white"
                : "border-line bg-white text-ink-2",
            ].join(" ")}
          >
            {o === "1h" ? "1시간" : o === "2h" ? "2시간" : o === "close" ? "마감까지" : "직접 설정"}
          </button>
        ))}
      </div>
      {expires === "custom" && (
        <label className="flex items-center gap-2 text-sm text-ink-2">
          마감 시각
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="rounded-lg border border-line px-3 py-2"
          />
          <span className="text-xs text-ink-3">까지</span>
        </label>
      )}

      {dup ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">이미 세일중인 항목이에요.</p>
          <p className="mt-0.5 text-xs">정보가 다르면 정정 제보를 보낼 수 있어요.</p>
          <button
            type="button"
            onClick={submitCorrection}
            className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white"
          >
            정정 제보하기
          </button>
        </div>
      ) : (
        <>
          {canNotify && (
            <label className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="size-4 accent-emerald-600"
              />
              🔔 즐겨찾기한 단골에게 이 세일 알림 보내기
            </label>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink active:bg-blue-800 disabled:bg-gray-300"
          >
            {submitting ? "등록 중…" : "세일 제보 등록"}
          </button>
        </>
      )}

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
