"use client";

import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";

/**
 * 사진 편집기 v2 (캔버스, 라이브러리 미사용).
 * 도구: 펜(다양한 색/굵기) · 지우개 · 모자이크(블러) · 자르기(핀치 줌·팬 후 화면영역으로 크롭).
 * 레이어: base(원본/크롭) + annot(펜/모자이크) 분리 → 지우개는 annot 만 지움.
 * 저장 시 합성하여 JPEG File 반환.
 */
const COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#111827", "#ffffff",
];
const PEN_WIDTHS = [3, 6, 12, 20];
const MAX_SIDE = 1600;

type Tool = "pen" | "eraser" | "blur" | "crop";

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

  // 변환(이미지→뷰): viewX = s*imgX + tx
  const s = useRef(1);
  const tx = useRef(0);
  const ty = useRef(0);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [penW, setPenW] = useState(PEN_WIDTHS[1]);
  const [ready, setReady] = useState(false);

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const penWRef = useRef(penW);
  penWRef.current = penW;

  // 포인터/드로잉 상태
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const last = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null);

  // ── 렌더 ──
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

  const fit = () => {
    const v = viewRef.current!;
    const base = baseRef.current!;
    const sc = Math.min(v.width / base.width, v.height / base.height);
    s.current = sc;
    tx.current = (v.width - base.width * sc) / 2;
    ty.current = (v.height - base.height * sc) / 2;
  };

  // ── 초기화 ──
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
      fit();
      render();
      setReady(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // 화면 좌표 → 이미지 좌표
  const toImg = (clientX: number, clientY: number) => {
    const v = viewRef.current!;
    const r = v.getBoundingClientRect();
    const vx = (clientX - r.left) * (v.width / r.width);
    const vy = (clientY - r.top) * (v.height / r.height);
    return { x: (vx - tx.current) / s.current, y: (vy - ty.current) / s.current };
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

  // 모자이크: base 영역을 픽셀화해 annot 에 원형으로 스탬프
  const mosaic = (cx: number, cy: number) => {
    const base = baseRef.current!;
    const annot = annotRef.current!;
    const size = 44 / s.current; // 화면상 일정 크기
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

  // ── 포인터 ──
  const onDown = (e: RPE<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const t = toolRef.current;
    if (t === "crop") {
      pinch.current = null;
      last.current = { x: e.clientX, y: e.clientY };
    } else {
      if (pointers.current.size > 1) return;
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
          const vmx = (mx - r.left) * (v.width / r.width);
          const vmy = (my - r.top) * (v.height / r.height);
          s.current *= ratio;
          tx.current = vmx - (vmx - tx.current) * ratio + (mx - pinch.current.mx);
          ty.current = vmy - (vmy - ty.current) * ratio + (my - pinch.current.my);
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
        render();
      }
      return;
    }

    if (pointers.current.size > 1 || !last.current) return;
    const p = toImg(e.clientX, e.clientY);
    if (t === "blur") {
      // 경로 보간 스탬프
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
    if (pointers.current.size < 2) pinch.current = null;
  };

  // ── 자르기: 현재 뷰에 보이는 이미지 영역으로 크롭 ──
  const applyCrop = () => {
    const v = viewRef.current!;
    const base = baseRef.current!;
    const annot = annotRef.current!;
    let x = -tx.current / s.current;
    let y = -ty.current / s.current;
    let w = v.width / s.current;
    let h = v.height / s.current;
    // 이미지 경계로 클램프
    x = Math.max(0, x);
    y = Math.max(0, y);
    w = Math.min(base.width - x, w);
    h = Math.min(base.height - y, h);
    if (w < 8 || h < 8) return;
    const cw = Math.round(w);
    const ch = Math.round(h);
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
    fit();
    render();
  };

  const reset = () => {
    fit();
    render();
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

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] flex h-[100dvh] flex-col bg-black/95"
      style={{ height: "100dvh" }}
    >
      <div
        className="flex items-center justify-between px-3 pb-3 text-sm text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <button type="button" onClick={onCancel}>취소</button>
        <span className="font-medium">사진 편집</span>
        <button type="button" onClick={save} className="font-semibold text-blue-300">저장</button>
      </div>

      <div ref={wrapRef} className="relative flex-1 overflow-hidden">
        <canvas
          ref={viewRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="block h-full w-full touch-none"
          style={{ touchAction: "none" }}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
            불러오는 중…
          </div>
        )}
      </div>

      <div
        className="flex flex-col gap-2 bg-black/90 px-3 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTool("pen")} className={chip(tool === "pen")}>✏️ 펜</button>
          <button type="button" onClick={() => setTool("eraser")} className={chip(tool === "eraser")}>🧽 지우개</button>
          <button type="button" onClick={() => setTool("blur")} className={chip(tool === "blur")}>🟦 모자이크</button>
          <button type="button" onClick={() => setTool("crop")} className={chip(tool === "crop")}>✂️ 자르기</button>
          {tool === "crop" && (
            <>
              <button type="button" onClick={applyCrop} className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white">적용</button>
              <button type="button" onClick={reset} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white">맞춤</button>
            </>
          )}
        </div>

        {(tool === "pen") && (
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
        {tool === "crop" && <p className="text-xs text-white/60">두 손가락으로 확대/축소·이동해 원하는 부분을 맞춘 뒤 ‘적용’.</p>}
        {tool === "blur" && <p className="text-xs text-white/60">가리고 싶은 부분을 문지르면 모자이크 처리돼요.</p>}
        {tool === "eraser" && <p className="text-xs text-white/60">펜·모자이크 표시를 지웁니다(원본 사진은 유지).</p>}
      </div>
    </div>
  );
}
