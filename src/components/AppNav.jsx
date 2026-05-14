"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import RefreshButton from "@/components/RefreshButton";
import RoleLoginMenu from "@/components/RoleLoginMenu";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function AppNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--acm-border)] bg-[color:var(--acm-bg)]/70 backdrop-blur">
      <div className="acm-container flex items-center justify-between py-4">
        <Link
          href="/"
          className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--acm-ring)]"
        >
          <Logo />
        </Link>
        <nav className="flex items-center gap-3">
          <RefreshButton className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-1)] px-3 py-2 text-sm font-semibold text-[color:var(--acm-fg)] transition hover:border-[color:var(--acm-accent-border)] hover:bg-[color:var(--acm-surface-12)] disabled:opacity-60" />
          <ThemeToggle />
          <RoleLoginMenu />
        </nav>
      </div>
    </header>
  );
}
