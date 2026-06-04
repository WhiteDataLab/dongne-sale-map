"use client";

import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";

/**
 * 간단 사진 편집기 (Phase: 사용자 요청). 캔버스 기반, 라이브러리 미사용.
 * - 펜: 색상/굵기 선택해 자유 드로잉(터치/마우스)
 * - 자르기: 영역을 드래그로 지정 후 적용
 * 저장 시 편집된 이미지를 File(JPEG)로 반환.
 */
const COLORS = ["#ef4444", "#3b82f6", "#facc15", "#22c55e", "#111827", "#ffffff"];
const WIDTHS = [3, 6, 12];
const MAX_SIDE = 1280;

export function PhotoEditor({
  file,
  onSave,
  onCancel,
}: {
  file: File;
  onSave: (edited: File) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"pen" | "crop">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drawing = useRef(false);
  const cropStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (Math.max(w, h) > MAX_SIDE) {
        const r = MAX_SIDE / Math.max(w, h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [file]);

  const internal = (cx: number, cy: number) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((cx - r.left) * c.width) / r.width, y: ((cy - r.top) * c.height) / r.height };
  };
  const css = (cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top, w: r.width, h: r.height };
  };

  const onDown = (e: RPE<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (mode === "pen") {
      drawing.current = true;
      const { x, y } = internal(e.clientX, e.clientY);
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      const p = css(e.clientX, e.clientY);
      cropStart.current = { x: p.x, y: p.y };
      setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
    }
  };
  const onMove = (e: RPE<HTMLCanvasElement>) => {
    if (mode === "pen") {
      if (!drawing.current) return;
      const { x, y } = internal(e.clientX, e.clientY);
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      if (!cropStart.current) return;
      const p = css(e.clientX, e.clientY);
      const sx = cropStart.current.x;
      const sy = cropStart.current.y;
      setCrop({
        x: Math.max(0, Math.min(sx, p.x)),
        y: Math.max(0, Math.min(sy, p.y)),
        w: Math.min(p.w, Math.abs(p.x - sx)),
        h: Math.min(p.h, Math.abs(p.y - sy)),
      });
    }
  };
  const onUp = () => {
    drawing.current = false;
    cropStart.current = null;
  };

  const applyCrop = () => {
    const c = canvasRef.current!;
    if (!crop || crop.w < 8 || crop.h < 8) return;
    const r = c.getBoundingClientRect();
    const rx = c.width / r.width;
    const ry = c.height / r.height;
    const sw = Math.round(crop.w * rx);
    const sh = Math.round(crop.h * ry);
    const tmp = document.createElement("canvas");
    tmp.width = sw;
    tmp.height = sh;
    tmp.getContext("2d")!.drawImage(c, crop.x * rx, crop.y * ry, sw, sh, 0, 0, sw, sh);
    c.width = sw;
    c.height = sh;
    c.getContext("2d")!.drawImage(tmp, 0, 0);
    setCrop(null);
  };

  const save = () => {
    canvasRef.current!.toBlob(
      (blob) => {
        if (!blob) return;
        const base = (file.name || "photo").replace(/\.[^.]+$/, "");
        onSave(new File([blob], `${base}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  const chip = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-white text-black" : "bg-white/15 text-white"}`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90">
      <div className="flex items-center justify-between p-3 text-sm text-white">
        <button type="button" onClick={onCancel}>
          취소
        </button>
        <span className="font-medium">사진 편집</span>
        <button type="button" onClick={save} className="font-semibold text-blue-300">
          저장
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-2">
        <div className="relative">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="block max-h-[58vh] max-w-full touch-none"
            style={{ touchAction: "none" }}
          />
          {mode === "crop" && crop && (
            <div
              className="pointer-events-none absolute border-2 border-blue-400 bg-blue-400/20"
              style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 bg-black/80 p-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("pen")} className={chip(mode === "pen")}>
            ✏️ 펜
          </button>
          <button type="button" onClick={() => setMode("crop")} className={chip(mode === "crop")}>
            ✂️ 자르기
          </button>
          {mode === "crop" && (
            <button
              type="button"
              onClick={applyCrop}
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white"
            >
              자르기 적용
            </button>
          )}
        </div>

        {mode === "pen" && (
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label="색상"
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`size-7 rounded-full border-2 ${color === c ? "border-white" : "border-white/20"}`}
              />
            ))}
            <span className="mx-1 h-5 w-px bg-white/30" />
            {WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                aria-label="굵기"
                onClick={() => setWidth(w)}
                className={`flex size-7 items-center justify-center rounded-full ${width === w ? "bg-white/30" : ""}`}
              >
                <span className="rounded-full bg-white" style={{ width: w, height: w }} />
              </button>
            ))}
          </div>
        )}
        {mode === "crop" && (
          <p className="text-xs text-white/60">이미지 위를 드래그해 자를 영역을 지정한 뒤 ‘자르기 적용’.</p>
        )}
      </div>
    </div>
  );
}
