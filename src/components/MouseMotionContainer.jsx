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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_10%,rgba(99,102,241,0.22),transparent_60%),radial-gradient(circle_at_90%_20%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(circle_at_55%_105%,rgba(217,70,239,0.14),transparent_60%)]" />
        <div className="acm-parallax absolute -top-44 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="acm-parallax-slow absolute -bottom-48 left-[10%] h-[520px] w-[520px] rounded-full bg-indigo-500/18 blur-3xl" />
        <div className="acm-parallax absolute top-24 right-[6%] h-[420px] w-[420px] rounded-full bg-sky-500/14 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--acm-overlay-1),var(--acm-overlay-2))]" />
        <div className="absolute inset-0 [background-image:radial-gradient(var(--acm-dot)_1px,transparent_1px)] [background-size:22px_22px] opacity-[0.18]" />
      </div>
      {children}
    </div>
  );
}
