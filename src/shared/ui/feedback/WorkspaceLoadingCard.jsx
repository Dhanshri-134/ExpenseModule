export function WorkspaceLoadingCard({ label = "Loading workspace..." }) {
  return (
    <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-40 rounded bg-[color:var(--acm-border)]" />
        <div className="h-10 rounded bg-[color:var(--acm-surface-2)]" />
        <div className="h-24 rounded bg-[color:var(--acm-surface-2)]" />
      </div>
      <div className="mt-4 text-sm text-[color:var(--acm-muted-fg)]">{label}</div>
    </div>
  );
}
