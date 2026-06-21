"use client";

import { useEffect, useRef, useState, type PointerEvent as RPE, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 사진 편집기 v4 (캔버스, 라이브러리 미사용) — 삼성 갤러리식 자르기.
 * 기본 도구 = 자르기. 도구: 자르기 · 펜 · 지우개 · 모자이크 · 되돌리기.
 *
 * 자르기(crop):
 * - 이미지를 화면에 '여백 포함' 전체 표시(contain) + 크롭 프레임 오버레이.
 * - 프레임 **가장자리/모서리를 끌어** 그만큼 잘라낸다(오른쪽→왼쪽=오른쪽 잘림 등). 안쪽을 끌면 이동.
 * - **비율 프리셋**(자유/원본/1:1/3:4/9:16/2:3/3:5/4:5/5:7) 선택 시 자동 비율 고정.
 * - **±90° 회전**, **상하반전 / 좌우반전**.
 * 펜/지우개/모자이크: 기존(cover 뷰)대로. 작업마다 스냅샷 → 되돌리기(최대 12회).
 */
const COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#111827", "#ffffff",
];
const PEN_WIDTHS = [3, 6, 12, 20];
const MAX_SIDE = 1600;
const MAX_HISTORY = 12;
const MIN_FRAME = 44; // 크롭 프레임 최소 변 길이(CSS px)

type Tool = "crop" | "pen" | "eraser" | "blur";
type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move";
type Rect = { x: number; y: number; w: number; h: number };

const RATIOS: { key: string; label: string }[] = [
  { key: "free", label: "자유" },
  { key: "orig", label: "원본" },
  { key: "1:1", label: "1:1" },
  { key: "3:4", label: "3:4" },
  { key: "9:16", label: "9:16" },
  { key: "2:3", label: "2:3" },
  { key: "3:5", label: "3:5" },
  { key: "4:5", label: "4:5" },
  { key: "5:7", label: "5:7" },
];

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

  const [tool, setTool] = useState<Tool>("crop");
  const [color, setColor] = useState(COLORS[0]);
  const [penW, setPenW] = useState(PEN_WIDTHS[1]);
  const [ready, setReady] = useState(false);
  const [histLen, setHistLen] = useState(0);
  const [ratioKey, setRatioKey] = useState<string>("free");
  const [frame, setFrame] = useState<Rect | null>(null);

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const penWRef = useRef(penW);
  penWRef.current = penW;
  const frameRef = useRef<Rect | null>(frame);
  frameRef.current = frame;
  const aspectRef = useRef<number | null>(null);

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const last = useRef<{ x: number; y: number } | null>(null);
  const dragHandle = useRef<Handle | null>(null);
  const dragStartFrame = useRef<Rect | null>(null);
  const dragStartPt = useRef<{ x: number; y: number } | null>(null);
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
    ctx.fillStyle = "#111827";
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

  // 펜/지우개/모자이크용: 여백 없이 화면을 꽉 채우도록 스케일/이동 보정
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

  // 자르기용: 이미지 전체가 보이도록(contain) 가운데 정렬
  const fitContain = () => {
    const v = viewRef.current!;
    const base = baseRef.current!;
    const sc = Math.min(v.width / base.width, v.height / base.height);
    s.current = sc;
    tx.current = (v.width - base.width * sc) / 2;
    ty.current = (v.height - base.height * sc) / 2;
  };

  // 화면에 표시된 이미지 영역(CSS px, wrap 기준)
  const dispRect = (): Rect => {
    const v = viewRef.current!;
    const r = v.getBoundingClientRect();
    const k = v.width / r.width; // 캔버스px / CSS px
    return {
      x: tx.current / k,
      y: ty.current / k,
      w: (baseRef.current!.width * s.current) / k,
      h: (baseRef.current!.height * s.current) / k,
    };
  };

  // 주어진 비율(aspect=w/h)로 표시영역 안에 꽉 맞춘 중앙 프레임
  const frameForAspect = (aspect: number | null): Rect => {
    const dr = dispRect();
    if (aspect == null) return { ...dr };
    let w = dr.w;
    let h = w / aspect;
    if (h > dr.h) {
      h = dr.h;
      w = h * aspect;
    }
    return { x: dr.x + (dr.w - w) / 2, y: dr.y + (dr.h - h) / 2, w, h };
  };

  const aspectOf = (key: string): number | null => {
    if (key === "free") return null;
    if (key === "orig") {
      const b = baseRef.current;
      return b ? b.width / b.height : null;
    }
    const [a, b] = key.split(":").map(Number);
    return a && b ? a / b : null;
  };

  const pushHistory = () => {
    if (!baseRef.current || !annotRef.current) return;
    history.current.push({ base: clone(baseRef.current), annot: clone(annotRef.current) });
    if (history.current.length > MAX_HISTORY) history.current.shift();
    setHistLen(history.current.length);
  };

  const relayout = () => {
    if (toolRef.current === "crop") {
      fitContain();
      render();
      setFrame(frameForAspect(aspectRef.current));
    } else {
      cover();
      clamp();
      render();
      setFrame(null);
    }
  };

  const undo = () => {
    const snap = history.current.pop();
    if (!snap) return;
    baseRef.current = clone(snap.base);
    annotRef.current = clone(snap.annot);
    setHistLen(history.current.length);
    relayout();
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
      fitContain();
      render();
      setFrame(frameForAspect(null)); // 기본 자유 비율, 전체 프레임
      setReady(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // 도구 전환 시 레이아웃 재구성(자르기=contain+프레임 / 그 외=cover)
  useEffect(() => {
    if (!ready) return;
    relayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, ready]);

  const toImg = (clientX: number, clientY: number) => {
    const v = viewRef.current!;
    const r = v.getBoundingClientRect();
    const vx = (clientX - r.left) * (v.width / r.width);
    const vy = (clientY - r.top) * (v.height / r.height);
    return { x: (vx - tx.current) / s.current, y: (vy - ty.current) / s.current };
  };
  const toCss = (clientX: number, clientY: number) => {
    const r = viewRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
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

  // ── 크롭 프레임 ──
  const hitHandle = (px: number, py: number): Handle | null => {
    const f = frameRef.current;
    if (!f) return null;
    const E = 26;
    const nearL = Math.abs(px - f.x) <= E;
    const nearR = Math.abs(px - (f.x + f.w)) <= E;
    const nearT = Math.abs(py - f.y) <= E;
    const nearB = Math.abs(py - (f.y + f.h)) <= E;
    const inX = px >= f.x - E && px <= f.x + f.w + E;
    const inY = py >= f.y - E && py <= f.y + f.h + E;
    if (!inX || !inY) return null;
    let h = "";
    if (nearT) h += "n";
    else if (nearB) h += "s";
    if (nearL) h += "w";
    else if (nearR) h += "e";
    if (h) return h as Handle;
    if (px > f.x && px < f.x + f.w && py > f.y && py < f.y + f.h) return "move";
    return null;
  };

  const moveFrame = (px: number, py: number) => {
    const dr = dispRect();
    const f0 = dragStartFrame.current!;
    const sp = dragStartPt.current!;
    let nx = f0.x + (px - sp.x);
    let ny = f0.y + (py - sp.y);
    nx = Math.max(dr.x, Math.min(nx, dr.x + dr.w - f0.w));
    ny = Math.max(dr.y, Math.min(ny, dr.y + dr.h - f0.h));
    setFrame({ x: nx, y: ny, w: f0.w, h: f0.h });
  };

  const resizeFrame = (handle: Handle, px: number, py: number) => {
    const dr = dispRect();
    const f0 = dragStartFrame.current!;
    const left = handle.includes("w");
    const right = handle.includes("e");
    const top = handle.includes("n");
    const bottom = handle.includes("s");
    const ar = aspectRef.current;

    if (ar == null) {
      let L = f0.x, T = f0.y, R = f0.x + f0.w, B = f0.y + f0.h;
      if (left) L = Math.min(px, R - MIN_FRAME);
      if (right) R = Math.max(px, L + MIN_FRAME);
      if (top) T = Math.min(py, B - MIN_FRAME);
      if (bottom) B = Math.max(py, T + MIN_FRAME);
      L = Math.max(dr.x, L);
      T = Math.max(dr.y, T);
      R = Math.min(dr.x + dr.w, R);
      B = Math.min(dr.y + dr.h, B);
      setFrame({ x: L, y: T, w: R - L, h: B - T });
      return;
    }

    // 비율 고정: 반대편(anchor)을 고정하고 비율 유지하며 표시영역 안으로 클램프
    const anchorX = right ? f0.x : left ? f0.x + f0.w : f0.x + f0.w / 2;
    const anchorY = bottom ? f0.y : top ? f0.y + f0.h : f0.y + f0.h / 2;
    const dirX = right ? 1 : left ? -1 : 0;
    const dirY = bottom ? 1 : top ? -1 : 0;

    let w: number;
    if (left || right) w = Math.abs(px - anchorX);
    else w = Math.abs(py - anchorY) * ar;
    if ((top || bottom) && (left || right)) {
      // 모서리: 두 축 중 더 많이 끈 쪽을 따라감
      const wByY = Math.abs(py - anchorY) * ar;
      if (wByY > w) w = wByY;
    }
    w = Math.max(MIN_FRAME, w);

    // 가로 방향 클램프
    if (dirX > 0) w = Math.min(w, dr.x + dr.w - anchorX);
    else if (dirX < 0) w = Math.min(w, anchorX - dr.x);
    else w = Math.min(w, Math.min(anchorX - dr.x, dr.x + dr.w - anchorX) * 2);
    let h = w / ar;
    // 세로 방향 클램프 후 가로 재계산
    if (dirY > 0 && h > dr.y + dr.h - anchorY) h = dr.y + dr.h - anchorY;
    else if (dirY < 0 && h > anchorY - dr.y) h = anchorY - dr.y;
    else if (dirY === 0) {
      const maxH = Math.min(anchorY - dr.y, dr.y + dr.h - anchorY) * 2;
      if (h > maxH) h = maxH;
    }
    w = h * ar;
    h = Math.max(MIN_FRAME / Math.max(ar, 0.0001), h);

    const x = dirX > 0 ? anchorX : dirX < 0 ? anchorX - w : anchorX - w / 2;
    const y = dirY > 0 ? anchorY : dirY < 0 ? anchorY - h : anchorY - h / 2;
    setFrame({ x, y, w, h });
  };

  const onDown = (e: RPE<HTMLCanvasElement>) => {
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* 일부 환경/합성 이벤트에서 캡처 불가 — 무시 */
    }
    const t = toolRef.current;
    if (t === "crop") {
      const p = toCss(e.clientX, e.clientY);
      const h = hitHandle(p.x, p.y);
      if (!h) return;
      dragHandle.current = h;
      dragStartFrame.current = frameRef.current ? { ...frameRef.current } : null;
      dragStartPt.current = { x: p.x, y: p.y };
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size > 1) return;
    pushHistory();
    const p = toImg(e.clientX, e.clientY);
    last.current = p;
    if (t === "blur") mosaic(p.x, p.y);
    else drawStroke(p, p, t === "eraser");
    render();
  };

  const onMove = (e: RPE<HTMLCanvasElement>) => {
    const t = toolRef.current;
    if (t === "crop") {
      if (!dragHandle.current || !dragStartFrame.current) return;
      const p = toCss(e.clientX, e.clientY);
      if (dragHandle.current === "move") moveFrame(p.x, p.y);
      else resizeFrame(dragHandle.current, p.x, p.y);
      return;
    }
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
    dragHandle.current = null;
  };

  // 비율 프리셋 선택
  const pickRatio = (key: string) => {
    setRatioKey(key);
    aspectRef.current = aspectOf(key);
    setFrame(frameForAspect(aspectRef.current));
  };

  // 잘라내기 적용(프레임 → 이미지 좌표)
  const applyCrop = () => {
    const f = frameRef.current;
    const base = baseRef.current;
    const annot = annotRef.current;
    if (!f || !base || !annot) return;
    const dr = dispRect();
    const ix = ((f.x - dr.x) / dr.w) * base.width;
    const iy = ((f.y - dr.y) / dr.h) * base.height;
    const iw = (f.w / dr.w) * base.width;
    const ih = (f.h / dr.h) * base.height;
    const x = Math.max(0, Math.round(ix));
    const y = Math.max(0, Math.round(iy));
    const w = Math.min(base.width - x, Math.round(iw));
    const h = Math.min(base.height - y, Math.round(ih));
    if (w < 8 || h < 8) return;
    pushHistory();
    const nb = document.createElement("canvas");
    nb.width = w;
    nb.height = h;
    nb.getContext("2d")!.drawImage(base, x, y, w, h, 0, 0, w, h);
    const na = document.createElement("canvas");
    na.width = w;
    na.height = h;
    na.getContext("2d")!.drawImage(annot, x, y, w, h, 0, 0, w, h);
    baseRef.current = nb;
    annotRef.current = na;
    fitContain();
    render();
    setFrame(frameForAspect(aspectRef.current));
  };

  // ±90° 회전
  const rotate = (dir: 1 | -1) => {
    pushHistory();
    for (const ref of [baseRef, annotRef] as const) {
      const c = ref.current!;
      const n = document.createElement("canvas");
      n.width = c.height;
      n.height = c.width;
      const ctx = n.getContext("2d")!;
      ctx.translate(n.width / 2, n.height / 2);
      ctx.rotate((dir * Math.PI) / 2);
      ctx.drawImage(c, -c.width / 2, -c.height / 2);
      ref.current = n;
    }
    if (ratioKey === "orig") aspectRef.current = aspectOf("orig");
    relayout();
  };

  // 반전(상하/좌우)
  const flip = (axis: "h" | "v") => {
    pushHistory();
    for (const ref of [baseRef, annotRef] as const) {
      const c = ref.current!;
      const n = document.createElement("canvas");
      n.width = c.width;
      n.height = c.height;
      const ctx = n.getContext("2d")!;
      if (axis === "h") {
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(0, c.height);
        ctx.scale(1, -1);
      }
      ctx.drawImage(c, 0, 0);
      ref.current = n;
    }
    relayout();
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
    `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-white text-black" : "bg-white/15 text-white"}`;
  const iconBtn =
    "flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-lg bg-white/15 px-2.5 text-sm font-medium text-white";

  // 모서리/가장자리 핸들 마크(시각용, 포인터는 캔버스가 처리)
  const handleMark = "absolute bg-white";
  const cornerBars = (pos: string) => {
    const base = "absolute bg-white";
    const sz = 18;
    const th = 3;
    const map: Record<string, ReactNode> = {
      nw: (
        <>
          <span className={base} style={{ left: -th, top: -th, width: sz, height: th }} />
          <span className={base} style={{ left: -th, top: -th, width: th, height: sz }} />
        </>
      ),
      ne: (
        <>
          <span className={base} style={{ right: -th, top: -th, width: sz, height: th }} />
          <span className={base} style={{ right: -th, top: -th, width: th, height: sz }} />
        </>
      ),
      sw: (
        <>
          <span className={base} style={{ left: -th, bottom: -th, width: sz, height: th }} />
          <span className={base} style={{ left: -th, bottom: -th, width: th, height: sz }} />
        </>
      ),
      se: (
        <>
          <span className={base} style={{ right: -th, bottom: -th, width: sz, height: th }} />
          <span className={base} style={{ right: -th, bottom: -th, width: th, height: sz }} />
        </>
      ),
    };
    return map[pos];
  };

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
        {tool === "crop" && frame && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: frame.x,
              top: frame.y,
              width: frame.w,
              height: frame.h,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              outline: "1px solid rgba(255,255,255,0.95)",
            }}
          >
            {/* 3분할 격자 */}
            <span className={`${handleMark} left-0 right-0 opacity-30`} style={{ top: "33.33%", height: 1 }} />
            <span className={`${handleMark} left-0 right-0 opacity-30`} style={{ top: "66.66%", height: 1 }} />
            <span className={`${handleMark} top-0 bottom-0 opacity-30`} style={{ left: "33.33%", width: 1 }} />
            <span className={`${handleMark} top-0 bottom-0 opacity-30`} style={{ left: "66.66%", width: 1 }} />
            {/* 모서리 마크 */}
            {cornerBars("nw")}
            {cornerBars("ne")}
            {cornerBars("sw")}
            {cornerBars("se")}
            {/* 가장자리 중앙 바 */}
            <span className={handleMark} style={{ left: "50%", top: -2, width: 22, height: 4, transform: "translateX(-50%)" }} />
            <span className={handleMark} style={{ left: "50%", bottom: -2, width: 22, height: 4, transform: "translateX(-50%)" }} />
            <span className={handleMark} style={{ top: "50%", left: -2, width: 4, height: 22, transform: "translateY(-50%)" }} />
            <span className={handleMark} style={{ top: "50%", right: -2, width: 4, height: 22, transform: "translateY(-50%)" }} />
          </div>
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">불러오는 중…</div>
        )}
      </div>

      <div
        className="flex shrink-0 flex-col gap-2 bg-black/90 px-3 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        {/* 도구 선택 — 자르기가 기본·첫번째 */}
        <div className="flex gap-2 overflow-x-auto">
          <button type="button" onClick={() => setTool("crop")} className={chip(tool === "crop")}>✂️ 자르기</button>
          <button type="button" onClick={() => setTool("pen")} className={chip(tool === "pen")}>✏️ 펜</button>
          <button type="button" onClick={() => setTool("eraser")} className={chip(tool === "eraser")}>🧽 지우개</button>
          <button type="button" onClick={() => setTool("blur")} className={chip(tool === "blur")}>🟦 모자이크</button>
        </div>

        {tool === "crop" && (
          <>
            {/* 비율 프리셋 */}
            <div className="flex gap-1.5 overflow-x-auto">
              {RATIOS.map((r) => (
                <button key={r.key} type="button" onClick={() => pickRatio(r.key)} className={chip(ratioKey === r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
            {/* 회전·반전·적용 */}
            <div className="flex items-center gap-2 overflow-x-auto">
              <button type="button" onClick={() => rotate(-1)} className={iconBtn} aria-label="왼쪽 90도 회전">↺ -90°</button>
              <button type="button" onClick={() => rotate(1)} className={iconBtn} aria-label="오른쪽 90도 회전">↻ +90°</button>
              <button type="button" onClick={() => flip("h")} className={iconBtn} aria-label="좌우반전">⇆ 좌우</button>
              <button type="button" onClick={() => flip("v")} className={iconBtn} aria-label="상하반전">⇅ 상하</button>
              <button type="button" onClick={() => pickRatio(ratioKey)} className={iconBtn} aria-label="프레임 초기화">⟳ 초기화</button>
              <button
                type="button"
                onClick={applyCrop}
                className="ml-auto shrink-0 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white"
              >
                잘라내기
              </button>
            </div>
            <p className="text-xs text-white/60">가장자리·모서리를 끌어 자를 영역을 정하거나, 비율을 골라 자동으로 맞춰요. 안쪽을 끌면 이동.</p>
          </>
        )}

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
        {tool === "blur" && <p className="text-xs text-white/60">가리고 싶은 부분을 문지르면 모자이크 처리돼요.</p>}
        {tool === "eraser" && <p className="text-xs text-white/60">펜·모자이크 표시를 지웁니다(원본 사진은 유지).</p>}
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(content, document.body);
}
