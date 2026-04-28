"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ROLE_LABELS } from "@/lib/roles";
import ThemeToggle from "@/components/theme/ThemeToggle";
import Image from "next/image";
import styles from "@/styles/auth/RoleLoginPanel.module.css";

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isEmail(value) {
  return typeof value === "string" && value.includes("@") && value.includes(".");
}

export default function RoleLoginPanel({ role }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const roleLabel = ROLE_LABELS[role] ?? "User";

  const [mode, setMode] = useState("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const resetMessages = () => {
    setMessage("");
    setError("");
  };

  const authorizeRole = async (roleKey) => {
    const res = await fetch("/api/auth/authorize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: roleKey }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: data?.error ?? "unauthorized" };
    }
    return { ok: true, data };
  };

  const checkConfig = async () => {
    const res = await fetch("/api/supabase/config", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    return data?.configured === true;
  };

  const resolveEmail = async (value) => {
    if (value.includes("@")) return { ok: true, email: value };
    const res = await fetch("/api/auth/resolve-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId: value }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.error ?? "not_found" };
    return { ok: true, email: data?.email };
  };

  const onLogin = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!supabase) {
      const serverConfigured = await checkConfig();
      setError(
        serverConfigured
          ? "Supabase keys are set, but the dev server needs a restart to expose NEXT_PUBLIC_* variables to the browser."
          : "Supabase is not configured."
      );
      return;
    }

    if (!loginId) {
      setError("Enter your User ID or Email ID.");
      return;
    }
    if (loginId.includes("@") && !isEmail(loginId)) {
      setError("Enter a valid Email ID.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);
    try {
      const resolved = await resolveEmail(loginId.trim());
      if (!resolved.ok || !resolved.email) {
        setError(
          resolved.error === "supabase_admin_not_configured"
            ? "User ID login needs SUPABASE_SERVICE_ROLE_KEY configured on the server. Use Email login or set the key."
            : "User ID / Email not found."
        );
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: resolved.email,
        password,
      });
      if (signInError) throw signInError;
      if (!data?.user) throw new Error("Login failed. Please try again.");

      const authz = await authorizeRole(role);
      if (!authz.ok) {
        const { data: me } = await supabase.auth.getUser();
        const who = me?.user
          ? ` (user id: ${me.user.id}${me.user.email ? `, email: ${me.user.email}` : ""})`
          : "";
        setError(
          role === "owner"
            ? `Your account is not registered as an Owner.${who} If you are the company owner in companies.owner_user_id, you still need a matching row in company_users with role='owner'.`
            : role === "manager"
              ? `Your account is not registered as a Manager.${who}`
              : `Your account is not registered as an Employee.${who}`
        );
        return;
      }

      await router.push(`/${role}`);
    } catch (err) {
      setError(err?.message || "Unable to login right now.");
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!supabase) {
      const serverConfigured = await checkConfig();
      setError(
        serverConfigured
          ? "Supabase keys are set, but the dev server needs a restart to expose NEXT_PUBLIC_* variables to the browser."
          : "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local then restart."
      );
      return;
    }

    if (!loginId) {
      setError("Enter your User ID or Email ID to reset the password.");
      return;
    }
    if (loginId.includes("@") && !isEmail(loginId)) {
      setError("Enter a valid Email ID.");
      return;
    }

    setBusy(true);
    try {
      const resolved = await resolveEmail(loginId.trim());
      if (!resolved.ok || !resolved.email) {
        setError(
          resolved.error === "supabase_admin_not_configured"
            ? "User ID reset needs SUPABASE_SERVICE_ROLE_KEY configured on the server. Use Email or set the key."
            : "User ID / Email not found."
        );
        return;
      }

      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
        "/reset-password"
      )}`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        resolved.email,
        { redirectTo }
      );
      if (resetError) throw resetError;

      setMessage(
        "Password reset email sent. Check your inbox and spam for the link."
      );
    } catch (err) {
      setError(err?.message || "Unable to send reset email right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
     <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        
        {/* LEFT - FORM */}
      <div className={styles.card}>
        <div className={styles.topBar}>
          <div className="acm-badge">Role: {roleLabel}</div>
          <div className={styles.topActions}>
            <ThemeToggle />
            <Link href="/" className={styles.homeButton}>
              Go to Home
            </Link>
          </div>
        </div>
        <h1 className={styles.heading}>
            {mode === "login" ? `Login as ${roleLabel}` : "Forgot password"}
        </h1>

        <form onSubmit={mode === "login" ? onLogin : onForgot} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>User ID / Email ID</label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="ACM-M-001 or you@company.com"
                  className="acm-input"
                  autoComplete="username"
                  required
                />
              </div>

              {mode === "login" ? (
                <div className={styles.field}>
                  <label className={styles.label}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="acm-input"
                    autoComplete="current-password"
                    required
                  />
                </div>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-500 dark:text-rose-200">
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
                className={classNames(
                  "acm-btn acm-btn-primary w-full",
                  busy || !supabase ? "opacity-70" : "acm-btn-lift"
                )}
              >
                {busy
                  ? "Please wait..."
                  : mode === "login"
                    ? "Login"
                    : "Send reset link"}
              </button>
        </form>

        <div className={styles.footerRow}>
          <button
            type="button"
            onClick={() => {
              resetMessages();
              setMode((m) => (m === "login" ? "forgot" : "login"));
            }}
            className={styles.linkButton}
          >
            {mode === "login" ? "Forgot password?" : "Back to login"}
          </button>
        </div>
      </div>
    {/* RIGHT - LOGO */}
        <div className="hidden lg:flex justify-center items-center">
          <div className="relative w-[400px] h-[400px]">
            <Image
              src="/assets/logo.png"
              alt="logo"
              fill
              
              className="object-contain drop-shadow-2xl"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
