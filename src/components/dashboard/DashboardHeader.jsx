"use client";

import { useEffect, useState } from "react";
import { BellIcon, MenuIcon } from "@/components/dashboard/icons";
import Modal from "@/components/dashboard/Modal";
import LogoutButton from "@/components/dashboard/LogoutButton";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "@/styles/DashboardShell.module.css";

export default function DashboardHeader({
  companyName = "Company",
  title,
  onOpenSidebar,
}) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!notificationOpen) return;
    let active = true;

    async function loadNotifications() {
      setLoading(true);
      setError("");
      const res = await fetch("/api/activity-logs");
      const json = await res.json().catch(() => null);
      if (!active) return;
      if (!res.ok) {
        setError(json?.error || "notifications_fetch_failed");
        setLoading(false);
        return;
      }
      setNotifications(json?.logs ?? []);
      setLoading(false);
    }

    loadNotifications();
    return () => {
      active = false;
    };
  }, [notificationOpen]);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerStart}>
            <button
              type="button"
              onClick={onOpenSidebar}
              className={styles.menuButton}
              aria-label="Open sidebar"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <div className={styles.headerText}>
              <div className={styles.company}>{companyName}</div>
            </div>
          </div>

          <div className={styles.headerActions}>
            <ThemeToggle />
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Notifications"
              title="Notifications"
              onClick={() => setNotificationOpen(true)}
            >
              <BellIcon className="h-5 w-5" />
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <Modal open={notificationOpen} title="Notifications" onClose={() => setNotificationOpen(false)}>
        <div className="space-y-3">
          {loading ? <div className="text-sm text-[color:var(--acm-muted-fg)]">Loading updates...</div> : null}
          {error ? <div className="text-sm text-rose-500">{error}</div> : null}
          {!loading && !error && !notifications.length ? (
            <div className="text-sm text-[color:var(--acm-muted-fg)]">No project updates yet.</div>
          ) : null}
          {notifications.map((item) => (
            <div key={item.id} className="rounded-[18px] border border-[color:var(--acm-border)] px-4 py-3">
              <div className="text-sm font-semibold">{item.message}</div>
              <div className="mt-1 text-xs text-[color:var(--acm-muted-fg)]">
                {item.actor?.name || item.actor?.user_code || "System"} | {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
