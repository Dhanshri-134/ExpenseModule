import Link from "next/link";

function Item({ href, label }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-[color:var(--acm-fg)]/80 transition hover:bg-[color:var(--acm-surface-2)] hover:text-[color:var(--acm-fg)]"
    >
      <span>{label}</span>
      <span className="text-xs text-[color:var(--acm-fg)]/40">→</span>
    </Link>
  );
}

export default function OwnerSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[color:var(--acm-border)] bg-[color:var(--acm-surface)]/40 p-4 lg:block">
      <div className="mb-4 text-xs font-semibold text-[color:var(--acm-fg)]/60">
        OWNER
      </div>
      <nav className="space-y-1">
        <Item href="/owner" label="Dashboard" />
        <Item href="/owner/projects" label="Project" />
        <Item href="/owner/staff" label="Staff" />
      </nav>
    </aside>
  );
}
