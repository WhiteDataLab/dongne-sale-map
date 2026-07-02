"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { haversineMeters } from "@/lib/geo";
import { CATEGORY_META } from "@/lib/constants";
import type { StoreDTO } from "@/lib/types";

/**
 * 원탭 세일 제보 시트 (콜드스타트 P0-1, 러브버그맵 '한 방 제보' 패턴).
 * 흐름: FAB "🔥 여기 세일중" → 근처 가게 한 번 탭 → 제보 완료. 2번 탭이면 끝.
 * 사진·가격·내용은 전부 **선택**(자세히 적기) — 서버(/api/sales)가 최소 등록을 허용(migration 44).
 * 어뷰징은 서버 가드(레이트리밋·같은 가게 하루 1회·활성 중복 409·신고 자동숨김)로 방어.
 */
export function QuickSaleSheet({
  stores,
  center,
  onClose,
  onToast,
  onDone,
  onRegisterStore,
}: {
  stores: StoreDTO[];
  center: { lat: number; lng: number } | null;
  onClose: () => void;
  onToast: (msg: string) => void;
  onDone: () => void; // 제보 성공 → 지도/피드 갱신
  onRegisterStore: () => void; // 목록에 없는 가게 → 가게 등록 모드로 전환
}) {
  const [store, setStore] = useState<StoreDTO | null>(null);
  const [detail, setDetail] = useState(false); // '자세히 적기(선택)' 펼침
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 지도 중심에서 가까운 인증 가게 순 (최대 12곳)
  const nearby = useMemo(() => {
    return stores
      .filter((s) => s.verified)
      .map((s) => ({
        s,
        d: center ? haversineMeters(s.lat, s.lng, center.lat, center.lng) : null,
      }))
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
      .slice(0, 12);
  }, [stores, center]);

  const distLabel = (d: number | null) =>
    d == null ? "" : d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;

  const submit = async () => {
    if (!store || busy) return;
    const trimmedPrice = price.trim();
    const priceNum = trimmedPrice ? Number(trimmedPrice) : undefined;
    if (trimmedPrice && (!Number.isFinite(priceNum) || (priceNum as number) < 0)) {
      onToast("세일가를 확인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      // 사진(선택) 업로드
      let photoUrls: string[] | undefined;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (up.status === 401) {
          setNeedLogin(true);
          return;
        }
        if (!up.ok) {
          const e = (await up.json().catch(() => ({}))) as { error?: string };
          onToast(e.error ?? "사진 업로드에 실패했어요.");
          return;
        }
        const { url } = (await up.json()) as { url: string };
        photoUrls = [url];
      }

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          title: title.trim() || undefined, // 미입력 → 서버 기본 제목
          salePrice: priceNum, // 미입력 → 가격 미입력(세일중 표시)
          expiresOption: "close", // 원탭은 가게 마감시간까지 자동
          photoUrls,
        }),
      });
      if (res.status === 401) {
        setNeedLogin(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        duplicate?: boolean;
        pointGranted?: number;
      };
      if (res.status === 409) {
        onToast(data.duplicate ? "이미 제보돼 있어요! 이웃이 먼저 올렸네요 👍" : (data.error ?? "잠시 후 다시 시도해 주세요."));
        return;
      }
      if (!res.ok) {
        onToast(data.error ?? "제보에 실패했어요.");
        return;
      }
      onToast(`🔥 제보 완료! +${data.pointGranted ?? 0}P — 이웃들이 곧 봐요`);
      onDone();
      onClose();
    } catch {
      onToast("네트워크 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2">
      <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-2xl sm:rounded-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-line-2 px-4 py-3">
          <h3 className="text-base font-extrabold text-ink">🔥 여기 세일중!</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-2.5 py-1 text-sm font-semibold text-ink-3"
          >
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {needLogin ? (
            <div className="py-4 text-center">
              <p className="text-sm font-bold text-ink">제보하려면 로그인이 필요해요</p>
              <p className="mt-1 text-xs text-ink-3">지도 구경은 로그인 없이 계속할 수 있어요.</p>
              <Link
                href="/login"
                className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-btn bg-brand text-sm font-bold text-white"
              >
                3초 로그인하고 제보하기
              </Link>
            </div>
          ) : !store ? (
            <>
              <p className="text-sm font-bold text-ink">어느 가게가 세일 중인가요?</p>
              <p className="mt-0.5 text-xs text-ink-3">가게를 누르면 바로 제보돼요. 사진·가격은 선택!</p>
              {nearby.length === 0 ? (
                <p className="mt-4 rounded-xl bg-surface-2 p-4 text-center text-sm text-ink-3">
                  이 화면에 보이는 가게가 없어요.
                  <br />
                  지도를 움직이거나, 가게를 먼저 등록해 주세요.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-line-2">
                  {nearby.map(({ s, d }) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setStore(s)}
                        className="flex min-h-[52px] w-full items-center gap-2.5 py-2 text-left"
                      >
                        <span className="text-xl">{CATEGORY_META[s.category].icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-ink">{s.name}</span>
                          <span className="block truncate text-xs text-ink-3">{s.address}</span>
                        </span>
                        {d != null && (
                          <span className="num shrink-0 text-xs font-semibold text-ink-4">{distLabel(d)}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={onRegisterStore}
                className="mt-3 min-h-[48px] w-full rounded-btn border border-brand text-sm font-bold text-brand"
              >
                찾는 가게가 없어요 — ➕ 가게 등록
              </button>
            </>
          ) : (
            <>
              {/* 선택된 가게 */}
              <div className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="text-xl">{CATEGORY_META[store.category].icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{store.name}</span>
                  <span className="block truncate text-xs text-ink-3">{store.address}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setStore(null)}
                  className="shrink-0 text-xs font-bold text-brand"
                >
                  바꾸기
                </button>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={busy}
                style={{ background: "var(--deal-grad)" }}
                className="mt-3 min-h-[56px] w-full rounded-btn text-base font-extrabold text-white shadow-[0_6px_16px_rgba(255,59,48,0.26)] disabled:opacity-50"
              >
                {busy ? "제보 중…" : "🔥 세일 제보 완료"}
              </button>
              <p className="mt-1.5 text-center text-[11px] font-medium text-ink-4">
                마감 시간은 가게 영업 마감까지 자동 설정돼요.
              </p>

              {/* 선택 확장: 내용/가격/사진 */}
              <button
                type="button"
                onClick={() => setDetail((v) => !v)}
                className="mt-2 w-full py-1.5 text-center text-xs font-bold text-ink-3"
              >
                {detail ? "간단히 접기 ▲" : "✏️ 자세히 적기 (선택) ▼"}
              </button>
              {detail && (
                <div className="mt-1 flex flex-col gap-2">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="무엇이 세일 중인가요? (예: 딸기 1박스 떨이)"
                    className="rounded-lg border border-line px-3 py-2.5 text-sm"
                  />
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    inputMode="numeric"
                    placeholder="세일가(원) — 알면 적어주세요"
                    className="rounded-lg border border-line px-3 py-2.5 text-sm"
                  />
                  {preview ? (
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          if (preview) URL.revokeObjectURL(preview);
                          setFile(null);
                          setPreview(null);
                        }}
                        aria-label="사진 삭제"
                        className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex min-h-[48px] items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-sm text-ink-3"
                    >
                      📷 사진 추가 (선택)
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setFile(f);
                        setPreview(URL.createObjectURL(f));
                      }
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
