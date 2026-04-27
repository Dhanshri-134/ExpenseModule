"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LogoutIcon } from "@/components/dashboard/icons";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    await router.push("/");
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={busy || !supabase}
      className="inline-flex items-center justify-center rounded-xl border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-2 text-[color:var(--acm-fg)]/80 transition hover:bg-[color:var(--acm-surface-2)] hover:text-[color:var(--acm-fg)] disabled:opacity-60"
      aria-label="Logout"
      title="Logout"
    >
      <LogoutIcon className="h-5 w-5" />
    </button>
  );
}
