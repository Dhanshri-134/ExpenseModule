"use client";

import { useState } from "react";
import { RefreshIcon } from "@/components/dashboard/icons";

export default function RefreshButton({
  className = "inline-flex items-center gap-2 rounded-xl border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-1)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--acm-surface-12)] disabled:opacity-60",
  iconClassName = "h-4 w-4",
  label = "Refresh",
  title = "Refresh page",
}) {
  const [busy, setBusy] = useState(false);

  const onRefresh = () => {
    setBusy(true);
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={busy}
      className={className}
      aria-label={label}
      title={title}
    >
      <RefreshIcon className={`${iconClassName}${busy ? " animate-spin" : ""}`} />
      {/* <span>{busy ? "Refreshing..." : label}</span> */}
    </button>
  );
}
