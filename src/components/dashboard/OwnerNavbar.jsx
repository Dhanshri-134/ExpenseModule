import { BellIcon } from "@/components/dashboard/icons";
import LogoutButton from "@/components/dashboard/LogoutButton";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function OwnerNavbar({ companyName = "Company" }) {
  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--acm-border)] bg-[color:var(--acm-bg)]/70 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-5 sm:px-8">
        <div className="text-sm font-semibold text-[color:var(--acm-fg)]">
          {companyName}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-2 text-[color:var(--acm-fg)]/80 transition hover:bg-[color:var(--acm-surface-2)] hover:text-[color:var(--acm-fg)]"
            aria-label="Notifications"
            title="Notifications"
          >
            <BellIcon className="h-5 w-5" />
          </button>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
