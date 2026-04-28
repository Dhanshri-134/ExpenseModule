"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

function Sun({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 17.4a5.4 5.4 0 1 0 0-10.8 5.4 5.4 0 0 0 0 10.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 2.4v2.3M12 19.3v2.3M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.4 12h2.3M19.3 12h2.3M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Moon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M21 14.3a7.7 7.7 0 0 1-10.8-10.8 8.4 8.4 0 1 0 10.8 10.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}


export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 👇 CRITICAL: prevent ANY SSR render
  if (!mounted) {
    return (
      <button className="inline-flex h-9 w-9 rounded-xl border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)]" />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center justify-center rounded-xl border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-1)] p-2 text-[color:var(--acm-bg)] transition hover:bg-[color:var(--acm-surface-12)]"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}