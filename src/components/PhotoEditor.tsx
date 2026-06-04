"use client";

import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";
import { createPortal } from "react-dom";

/**
 * 사진 편집기 v3 (캔버스, 라이브러리 미사용).
 * 도구: 펜(색/굵기) · 지우개 · 모자이크 · 자르기(줌 / 박스) · 되돌리기(복원).
 * - 과도 축소 시 여백 없이 화면을 꽉 채우도록(cover) 스케일/이동 클램프.
 * - 레이어 분리(base/annot)로 지우개는 주석만 제거.
 * - 작업마다 스냅샷 저장 → 되돌리기(최대 12회).
 */
const COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#111827", "#ffffff",
];
const PEN_WIDTHS = [3, 6, 12, 20];
const MAX_SIDE = 1600;
const MAX_HISTORY = 12;

type Tool = "pen" | "eraser" | "blur" | "crop";

function clone(c: HTMLCanvasElement) {
  const n = document.createElement("canvas");
  n.width = c.width;
  n.height = c.height;
  n.getContext("2d")!.drawImage(c, 0, 0);
  return n;
}

export function PhotoEditor({
  file,
  onSave,
  onCancel,
}: {
  file: File;
  onSave: (edited: File) => void;
  onCancel: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const annotRef = useRef<HTMLCanvasElement | null>(null);

  const s = useRef(1);
  const tx = useRef(0);
  const ty = useRef(0);

  const [tool, setTool] = useState<Tool>("pen");
  const [cropMode, setCropMode] = useState<"zoom" | "box">("zoom");
  const [color, setColor] = useState(COLORS[0]);
  const [penW, setPenW] = useState(PEN_WIDTHS[1]);
  const [ready, setReady] = useState(false);
  const [histLen, setHistLen] = useState(0);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const cropModeRef = useRef(cropMode);
  cropModeRef.current = cropMode;
  const colorRef = useRef(color);
  colorRef.current = color;
  const penWRef = useRef(penW);
  penWRef.current = penW;

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const last = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const boxStart = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<{ base: HTMLCanvasElement; annot: HTMLCanvasElement }[]>([]);

  const [viewH, setViewH] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setViewH(window.visualViewport?.height ?? window.innerHeight);
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const render = () => {
    const v = viewRef.current;
    const base = baseRef.current;
    const annot = annotRef.current;
    if (!v || !base || !annot) return;
    const ctx = v.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, v.width, v.height);
    ctx.setTransform(s.current, 0, 0, s.current, tx.current, ty.current);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, 0, 0);
    ctx.drawImage(annot, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const coverScale = () => {
    const v = viewRef.current!;
    const base = baseRef.current!;
    return Math.max(v.width / base.width, v.height / base.height);
  };

  // 여백 없이 화면을 꽉 채우도록 스케일/이동 보정
  const clamp = () => {
    const v = viewRef.current!;
    const base = baseRef.current!;
    const minS = coverScale();
    if (s.current < minS) s.current = minS;
    if (s.current > minS * 8) s.current = minS * 8;
    const sw = base.width * s.current;
    const sh = base.height * s.current;
    tx.current = Math.min(0, Math.max(v.width - sw, tx.current));
    ty.current = Math.min(0, Math.max(v.height - sh, ty.current));
  };

  const cover = () => {
    const v = viewRef.current!;
    const base = baseRef.current!;
    s.current = coverScale();
    tx.current = (v.width - base.width * s.current) / 2;
    ty.current = (v.height - base.height * s.current) / 2;
  };

  const pushHistory = () => {
    if (!baseRef.current || !annotRef.current) return;
    history.current.push({ base: clone(baseRef.current), annot: clone(annotRef.current) });
    if (history.current.length > MAX_HISTORY) history.current.shift();
    setHistLen(history.current.length);
  };

  const undo = () => {
    const snap = history.current.pop();
    if (!snap) return;
    baseRef.current = clone(snap.base);
    annotRef.current = clone(snap.annot);
    setHistLen(history.current.length);
    setCropRect(null);
    cover();
    clamp();
    render();
  };

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const v = viewRef.current;
      const wrap = wrapRef.current;
      if (!v || !wrap) return;
      v.width = wrap.clientWidth;
      v.height = wrap.clientHeight;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (Math.max(w, h) > MAX_SIDE) {
        const r = MAX_SIDE / Math.max(w, h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const base = document.createElement("canvas");
      base.width = w;
      base.height = h;
      base.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const annot = document.createElement("canvas");
      annot.width = w;
      annot.height = h;
      baseRef.current = base;
      annotRef.current = annot;
      cover();
      clamp();
      render();
      setReady(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const toImg = (clientX: number, clientY: number) => {
    const v = viewRef.current!;
    const r = v.getBoundingClientRect();
    const vx = (clientX - r.left) * (v.width / r.width);
    const vy = (clientY - r.top) * (v.height / r.height);
    return { x: (vx - tx.current) / s.current, y: (vy - ty.current) / s.current };
  };
  const toCss = (clientX: number, clientY: number) => {
    const r = viewRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top, w: r.width, h: r.height };
  };

  const drawStroke = (a: { x: number; y: number }, b: { x: number; y: number }, erase: boolean) => {
    const ctx = annotRef.current!.getContext("2d")!;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = (erase ? 24 : penWRef.current) / s.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  };

  const mosaic = (cx: number, cy: number) => {
    const base = baseRef.current!;
    const annot = annotRef.current!;
    const size = 44 / s.current;
    const sx = cx - size / 2;
    const sy = cy - size / 2;
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.round(size * 0.12));
    small.height = Math.max(1, Math.round(size * 0.12));
    const sctx = small.getContext("2d")!;
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(base, sx, sy, size, size, 0, 0, small.width, small.height);
    const ctx = annot.getContext("2d")!;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(small, 0, 0, small.width, small.height, sx, sy, size, size);
    ctx.restore();
  };

  const onDown = (e: RPE<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const t = toolRef.current;
    if (t === "crop") {
      if (cropModeRef.current === "box") {
        const p = toCss(e.clientX, e.clientY);
        boxStart.current = { x: p.x, y: p.y };
        setCropRect({ x: p.x, y: p.y, w: 0, h: 0 });
      } else {
        pinch.current = null;
        last.current = { x: e.clientX, y: e.clientY };
      }
    } else {
      if (pointers.current.size > 1) return;
      pushHistory(); // 스트로크/모자이크 시작 전 스냅샷
      const p = toImg(e.clientX, e.clientY);
      last.current = p;
      if (t === "blur") mosaic(p.x, p.y);
      else drawStroke(p, p, t === "eraser");
      render();
    }
  };

  const onMove = (e: RPE<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const t = toolRef.current;

    if (t === "crop") {
      if (cropModeRef.current === "box") {
        if (!boxStart.current) return;
        const p = toCss(e.clientX, e.clientY);
        const sx = boxStart.current.x;
        const sy = boxStart.current.y;
        setCropRect({
          x: Math.max(0, Math.min(sx, p.x)),
          y: Math.max(0, Math.min(sy, p.y)),
          w: Math.min(p.w, Math.abs(p.x - sx)),
          h: Math.min(p.h, Math.abs(p.y - sy)),
        });
        return;
      }
      const pts = [...pointers.current.values()];
      if (pts.length >= 2) {
        const [a, b] = pts;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        if (pinch.current) {
          const ratio = dist / pinch.current.dist;
          const v = viewRef.current!;
          const r = v.getBoundingClientRect();
          const k = v.width / r.width;
          const vmx = (mx - r.left) * k;
          const vmy = (my - r.top) * k;
          s.current *= ratio;
          tx.current = vmx - (vmx - tx.current) * ratio + (mx - pinch.current.mx) * k;
          ty.current = vmy - (vmy - ty.current) * ratio + (my - pinch.current.my) * k;
          clamp();
          render();
        }
        pinch.current = { dist, mx, my };
      } else if (last.current) {
        const v = viewRef.current!;
        const r = v.getBoundingClientRect();
        const k = v.width / r.width;
        tx.current += (e.clientX - last.current.x) * k;
        ty.current += (e.clientY - last.current.y) * k;
        last.current = { x: e.clientX, y: e.clientY };
        clamp();
        render();
      }
      return;
    }

    if (pointers.current.size > 1 || !last.current) return;
    const p = toImg(e.clientX, e.clientY);
    if (t === "blur") {
      const steps = Math.max(1, Math.round(Math.hypot(p.x - last.current.x, p.y - last.current.y) / (10 / s.current)));
      for (let i = 1; i <= steps; i++) {
        mosaic(
          last.current.x + ((p.x - last.current.x) * i) / steps,
          last.current.y + ((p.y - last.current.y) * i) / steps,
        );
      }
    } else {
      drawStroke(last.current, p, t === "eraser");
    }
    last.current = p;
    render();
  };

  const onUp = (e: RPE<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    last.current = null;
    boxStart.current = null;
    if (pointers.current.size < 2) pinch.current = null;
  };

  const cropTo = (ix: number, iy: number, iw: number, ih: number) => {
    const base = baseRef.current!;
    const annot = annotRef.current!;
    let x = Math.max(0, ix);
    let y = Math.max(0, iy);
    let w = Math.min(base.width - x, iw);
    let h = Math.min(base.height - y, ih);
    if (w < 8 || h < 8) return;
    const cw = Math.round(w);
    const ch = Math.round(h);
    pushHistory();
    const nb = document.createElement("canvas");
    nb.width = cw;
    nb.height = ch;
    nb.getContext("2d")!.drawImage(base, x, y, w, h, 0, 0, cw, ch);
    const na = document.createElement("canvas");
    na.width = cw;
    na.height = ch;
    na.getContext("2d")!.drawImage(annot, x, y, w, h, 0, 0, cw, ch);
    baseRef.current = nb;
    annotRef.current = na;
    setCropRect(null);
    cover();
    clamp();
    render();
  };

  const applyZoomCrop = () => {
    const v = viewRef.current!;
    cropTo(-tx.current / s.current, -ty.current / s.current, v.width / s.current, v.height / s.current);
  };
  const applyBoxCrop = () => {
    if (!cropRect || cropRect.w < 8 || cropRect.h < 8) return;
    const v = viewRef.current!;
    const r = v.getBoundingClientRect();
    const k = v.width / r.width;
    cropTo(
      (cropRect.x * k - tx.current) / s.current,
      (cropRect.y * k - ty.current) / s.current,
      (cropRect.w * k) / s.current,
      (cropRect.h * k) / s.current,
    );
  };

  const save = () => {
    const base = baseRef.current!;
    const annot = annotRef.current!;
    const out = document.createElement("canvas");
    out.width = base.width;
    out.height = base.height;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(base, 0, 0);
    ctx.drawImage(annot, 0, 0);
    out.toBlob(
      (blob) => {
        if (!blob) return;
        const name = (file.name || "photo").replace(/\.[^.]+$/, "");
        onSave(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  const chip = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-white text-black" : "bg-white/15 text-white"}`;

  const content = (
    <div
      className="fixed inset-x-0 top-0 z-[60] flex flex-col overflow-hidden bg-black/95"
      style={{ height: viewH ? `${viewH}px` : "100vh" }}
    >
      <div className="flex shrink-0 items-center justify-between p-3 text-sm text-white">
        <button type="button" onClick={onCancel}>취소</button>
        <button
          type="button"
          onClick={undo}
          disabled={histLen === 0}
          className={`rounded-lg px-3 py-1 ${histLen === 0 ? "text-white/30" : "bg-white/15"}`}
        >
          ↩ 되돌리기
        </button>
        <button type="button" onClick={save} className="font-semibold text-blue-300">저장</button>
      </div>

      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={viewRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="block h-full w-full touch-none"
          style={{ touchAction: "none" }}
        />
        {tool === "crop" && cropMode === "box" && cropRect && (
          <div
            className="pointer-events-none absolute border-2 border-blue-400 bg-blue-400/20"
            style={{ left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }}
          />
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">불러오는 중…</div>
        )}
      </div>

      <div
        className="flex shrink-0 flex-col gap-2 bg-black/90 px-3 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTool("pen")} className={chip(tool === "pen")}>✏️ 펜</button>
          <button type="button" onClick={() => setTool("eraser")} className={chip(tool === "eraser")}>🧽 지우개</button>
          <button type="button" onClick={() => setTool("blur")} className={chip(tool === "blur")}>🟦 모자이크</button>
          <button type="button" onClick={() => setTool("crop")} className={chip(tool === "crop")}>✂️ 자르기</button>
        </div>

        {tool === "pen" && (
          <div className="flex flex-wrap items-center gap-1.5">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label="색상" onClick={() => setColor(c)} style={{ background: c }}
                className={`size-6 rounded-full border-2 ${color === c ? "border-white" : "border-white/20"}`} />
            ))}
            <span className="mx-1 h-5 w-px bg-white/30" />
            {PEN_WIDTHS.map((w) => (
              <button key={w} type="button" aria-label="굵기" onClick={() => setPenW(w)}
                className={`flex size-7 items-center justify-center rounded-full ${penW === w ? "bg-white/30" : ""}`}>
                <span className="rounded-full bg-white" style={{ width: w, height: w }} />
              </button>
            ))}
          </div>
        )}
        {tool === "crop" && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setCropMode("zoom")} className={chip(cropMode === "zoom")}>🔍 줌 자르기</button>
            <button type="button" onClick={() => setCropMode("box")} className={chip(cropMode === "box")}>⬚ 박스 자르기</button>
            <button
              type="button"
              onClick={cropMode === "zoom" ? applyZoomCrop : applyBoxCrop}
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white"
            >
              적용
            </button>
            <button type="button" onClick={() => { setCropRect(null); cover(); clamp(); render(); }}
              className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white">맞춤</button>
          </div>
        )}
        {tool === "crop" && cropMode === "zoom" && <p className="text-xs text-white/60">두 손가락으로 확대·이동(여백 없이 꽉 채워짐) 후 ‘적용’.</p>}
        {tool === "crop" && cropMode === "box" && <p className="text-xs text-white/60">캡처처럼 네모를 그려 영역을 지정한 뒤 ‘적용’.</p>}
        {tool === "blur" && <p className="text-xs text-white/60">가리고 싶은 부분을 문지르면 모자이크 처리돼요.</p>}
        {tool === "eraser" && <p className="text-xs text-white/60">펜·모자이크 표시를 지웁니다(원본 사진은 유지).</p>}
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(content, document.body);
}
