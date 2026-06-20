"use client";

import { useEffect, useRef, useState } from "react";

/** 스크롤 시 부드럽게 등장(fade + up). Apple식 스크롤 스토리텔링용. */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  // 접근성: prefers-reduced-motion 사용자는 등장 모션 없이 즉시 표시.
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setReduce(true);
      setShow(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const visible = show || reduce;
  return (
    <div
      ref={ref}
      style={reduce ? undefined : { transitionDelay: `${delay}ms` }}
      className={`${reduce ? "" : "transition-all duration-700 ease-out"} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
