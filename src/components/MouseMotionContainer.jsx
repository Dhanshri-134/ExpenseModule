"use client";

import { useEffect, useRef } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

export default function MouseMotionContainer({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;

    let raf = 0;
    const setVars = (x, y) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", String(x));
        el.style.setProperty("--my", String(y));
      });
    };

    const onMove = (event) => {
      const rect = el.getBoundingClientRect();
      const clientX =
        typeof event.clientX === "number" ? event.clientX : rect.left + rect.width / 2;
      const clientY =
        typeof event.clientY === "number" ? event.clientY : rect.top + rect.height / 2;

      const nx = (clientX - rect.left) / rect.width - 0.5;
      const ny = (clientY - rect.top) / rect.height - 0.5;

      setVars(nx.toFixed(4), ny.toFixed(4));
    };

    const onLeave = () => setVars("0", "0");

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="relative isolate">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="acm-parallax-slow absolute -bottom-48 left-[10%] h-[520px] w-[520px] rounded-full bg-blue-600/18 blur-3xl" />
        <div className="acm-parallax absolute top-24 right-[6%] h-[420px] w-[420px] rounded-full bg-blue-400/14 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--acm-overlay-1),var(--acm-overlay-2))]" />
        <div className="absolute inset-0 [background-image:radial-gradient(var(--acm-dot)_1px,transparent_1px)] [background-size:22px_22px] opacity-[0.18]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--acm-overlay-1),var(--acm-overlay-2))]" />
        <div className="absolute inset-0 [background-image:radial-gradient(var(--acm-dot)_1px,transparent_1px)] [background-size:22px_22px] opacity-[0.18]" />
      </div>
      {children}
    </div>
  );
}