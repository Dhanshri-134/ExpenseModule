"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const ITEMS = [
  { key: "owner", label: "Owner" },
  { key: "manager", label: "Manager" },
  { key: "employee", label: "Employee" },
];

export default function RoleLoginMenu() {
  const buttonId = useId();
  const menuId = `${buttonId}-menu`;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    const onPointerDown = (event) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(event.target)) setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={buttonId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="acm-btn-nav"
      >
        Login
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`transition ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M7 10l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          className="absolute right-0 mt-3 w-56 origin-top-right rounded-[1.4rem] border border-[color:var(--acm-border)] bg-[color:var(--acm-panel)] p-2 backdrop-blur"
        >
          <div className="px-3 pb-2 pt-2 text-xs text-[color:var(--acm-muted-fg)]">
            Choose your role
          </div>
          {ITEMS.map((item) => (
            <Link
              key={item.key}
              role="menuitem"
              href={`/login/${encodeURIComponent(item.key)}`}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-[color:var(--acm-fg)] transition hover:bg-[color:var(--acm-surface-2)] focus:bg-[color:var(--acm-surface-2)] focus:outline-none"
              onClick={() => setOpen(false)}
            >
              <span>{item.label}</span>
              <span className="text-xs text-[color:var(--acm-accent)]">→</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

