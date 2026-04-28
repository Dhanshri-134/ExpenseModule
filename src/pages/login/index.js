"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

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
        typeof event.clientX === "number"
          ? event.clientX
          : rect.left + rect.width / 2;
      const clientY =
        typeof event.clientY === "number"
          ? event.clientY
          : rect.top + rect.height / 2;

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
    <div ref={ref} className="relative isolate min-h-screen flex items-center">
      {/* Background Effects */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_10%,rgba(30,58,138,0.22),transparent_60%),radial-gradient(circle_at_90%_20%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(circle_at_55%_105%,rgba(37,99,235,0.14),transparent_60%)]" />
        <div className="acm-parallax absolute -top-44 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-blue-800/20 blur-3xl" />
        <div className="acm-parallax-slow absolute -bottom-48 left-[10%] h-[520px] w-[520px] rounded-full bg-blue-600/18 blur-3xl" />
        <div className="acm-parallax absolute top-24 right-[6%] h-[420px] w-[420px] rounded-full bg-blue-400/14 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--acm-overlay-1),var(--acm-overlay-2))]" />
        <div className="absolute inset-0 [background-image:radial-gradient(var(--acm-dot)_1px,transparent_1px)] [background-size:22px_22px] opacity-[0.18]" />
      </div>

      {/* Main Layout */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 px-6 items-center">
        
        {/* Left Side - Content */}
         <div className="min-h-screen acm-app">
      <div className="acm-container py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Login</h1>
        <p className="mt-3 text-[color:var(--acm-fg)]/70">
          Choose a role to continue.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/login/owner" className="acm-btn acm-btn-primary acm-btn-lift">
            Continue as Owner
          </Link>
          <Link
            href="/login/manager"
            className="acm-btn acm-btn-employee acm-btn-lift"
          >
            Continue as Manager
          </Link>
          <Link
            href="/login/employee"
            className="acm-btn acm-btn-employee acm-btn-lift"
          >
            Continue as Employee
          </Link>
        </div>
      </div>
    </div>

        {/* Right Side - Logo / Illustration */}
        <div className="hidden lg:flex justify-center items-center">
          <div className="relative w-[420px] h-[420px]">
            <Image
              src="/assets/logo.png"
              alt="Logo"
              fill
              
              className="object-contain drop-shadow-2xl"
              priority
            />
          </div>
        </div>

      </div>
    </div>
  );
}
   

export async function getServerSideProps(ctx) {
  const role = typeof ctx.query.role === "string" ? ctx.query.role.toLowerCase() : "";
  if (role === "owner" || role === "manager" || role === "employee") {
    return {
      redirect: {
        destination: `/login/${role}`,
        permanent: false,
      },
    };
  }
  return { props: {} };
}

