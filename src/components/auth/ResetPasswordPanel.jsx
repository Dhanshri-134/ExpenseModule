"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import PasswordInput from "@/components/shared/PasswordInput";

export default function ResetPasswordPanel() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!supabase) {
      setError(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      setMessage("Password updated. Redirecting...");
      setTimeout(() => {
        router.push("/");
      }, 900);
    } catch (err) {
      setError(err?.message || "Unable to update password right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen text-[color:var(--acm-fg)]">
      <div className="acm-container py-16">
        <div className="max-w-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="acm-badge">Password recovery</div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">
            Set a new password
          </h1>
          <p className="mt-3 text-[color:var(--acm-muted-fg)]">
            If you opened this page from the reset email, your session should
            be active. Set a new password below.
          </p>

          <div className="mt-8 acm-surface-strong p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="acm-form-label">New password</label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="acm-input"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div>
                <label className="acm-form-label">Confirm password</label>
                <PasswordInput
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="acm-input"
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                />
              </div>

              {error ? (
                <div className="acm-message-error">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className={`acm-btn acm-btn-primary w-full ${
                  busy || !supabase ? "opacity-70" : "acm-btn-lift"
                }`}
              >
                {busy ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>

          <div className="mt-6 text-xs text-[color:var(--acm-muted-fg)]">
            If you see invalid token errors, request a new reset email from the
            login page.
          </div>
        </div>
      </div>
    </div>
  );
}
