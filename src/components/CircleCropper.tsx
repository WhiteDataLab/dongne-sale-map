"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 원형 프로필 크롭. 이미지를 드래그(이동)·슬라이더(확대)로 원 안에 맞춘 뒤
 * 정사각형(원에 외접)으로 잘라 저장한다. 표시 시 rounded-full 로 원형이 된다.
 */
const VIEW = 256; // 화면 미리보기 한 변(px)
const OUT = 512; // 저장 출력 한 변(px)

export function CircleCropper({
  file,
  onSave,
  onCancel,
}: {
  file: File;
  onSave: (f: File) => void;
  onCancel: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1); // 절대 배율(px/소스px)
  const [zoom, setZoom] = useState(1); // 슬라이더(1~3)
  const baseScaleRef = useRef(1); // cover 기준 배율
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      const cover = Math.max(VIEW / el.naturalWidth, VIEW / el.naturalHeight);
      baseScaleRef.current = cover;
      setScale(cover);
      setZoom(1);
      setOffset({
        x: (VIEW - el.naturalWidth * cover) / 2,
        y: (VIEW - el.naturalHeight * cover) / 2,
      });
      setImg(el);
    };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 이미지가 항상 뷰포트(원)를 덮도록 오프셋을 가둔다 → 빈 공간 노출 방지.
  const clamp = (o: { x: number; y: number }, sc: number, el: HTMLImageElement | null) => {
    if (!el) return o;
    const w = el.naturalWidth * sc;
    const h = el.naturalHeight * sc;
    const minX = Math.min(0, VIEW - w); // 오른쪽 끝이 뷰포트 안으로 들어오지 않게
    const minY = Math.min(0, VIEW - h);
    return {
      x: Math.min(0, Math.max(minX, o.x)),
      y: Math.min(0, Math.max(minY, o.y)),
    };
  };

  const onZoom = (z: number) => {
    const newScale = baseScaleRef.current * z;
    const c = VIEW / 2;
    const f = newScale / scale;
    setOffset((o) => clamp({ x: c - (c - o.x) * f, y: c - (c - o.y) * f }, newScale, img));
    setScale(newScale);
    setZoom(z);
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clamp({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }, scale, img));
  };
  const onUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  const save = () => {
    if (!img) return;
    setBusy(true);
    const ratio = OUT / VIEW;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      return;
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(
      img,
      offset.x * ratio,
      offset.y * ratio,
      img.naturalWidth * scale * ratio,
      img.naturalHeight * scale * ratio,
    );
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) return;
        onSave(new File([blob], "profile.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 p-6">
      <h3 className="mb-4 text-sm font-medium text-white">원 안에 맞춰 주세요 (드래그·확대)</h3>

      <div
        className="relative touch-none overflow-hidden rounded-lg bg-gray-900"
        style={{ width: VIEW, height: VIEW }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
            style={{
              width: img.naturalWidth * scale,
              height: img.naturalHeight * scale,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        )}
        {/* 원형 마스크: 원 밖을 어둡게 + 흰 테두리 */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80"
          style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
        />
      </div>

      <input
        type="range"
        min={1}
        max={3}
        step={0.01}
        value={zoom}
        onChange={(e) => onZoom(Number(e.target.value))}
        className="mt-5 w-64 max-w-full"
        aria-label="확대"
      />

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/40 px-5 py-2 text-sm font-medium text-white"
        >
          취소
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !img}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:bg-gray-500"
        >
          {busy ? "처리 중…" : "이 사진으로"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
