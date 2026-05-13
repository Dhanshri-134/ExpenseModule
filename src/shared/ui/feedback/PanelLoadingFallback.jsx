"use client";

export function PanelLoadingFallback({ message = "Loading panel..." }) {
  return (
    <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 text-sm text-[color:var(--acm-muted-fg)] shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
      {message}
    </div>
  );
}
