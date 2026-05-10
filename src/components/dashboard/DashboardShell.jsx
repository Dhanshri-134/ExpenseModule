"use client";

import { useMemo, useState } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { useApiQuery } from "@/lib/client/apiQuery";
import styles from "@/styles/DashboardShell.module.css";

function withCacheBuster(url, token) {
  const value = String(url || "").trim();
  if (!value || !token) return value;
  return `${value}${value.includes("?") ? "&" : "?"}v=${encodeURIComponent(token)}`;
}

export default function DashboardShell({
  companyName,
  navigation,
  viewer,
  title,
  showBackButton = false,
  backHref = "",
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const settingsQuery = useApiQuery("/api/settings");
  const liveLogoUrl = settingsQuery.data?.company?.logoDataUrl || "";
  const resolvedViewer = useMemo(() => {
    if (!viewer) return viewer;
    const cacheToken = settingsQuery.updatedAt || "initial";
    const nextLogo = liveLogoUrl
      ? withCacheBuster(liveLogoUrl, cacheToken)
      : viewer.companyLogoUrl || "";

    return {
      ...viewer,
      companyLogoUrl: nextLogo,
    };
  }, [liveLogoUrl, settingsQuery.updatedAt, viewer]);

  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <DashboardSidebar
          companyName={companyName}
          navigation={navigation}
          viewer={resolvedViewer}
          showBackButton={showBackButton}
          backHref={backHref}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <div className={styles.content}>
          <DashboardHeader
            companyName={companyName}
            title={title}
            onOpenSidebar={() => setMobileOpen(true)}
          />
          <main className={styles.main}>{children}</main>
        </div>
      </div>
    </div>
  );
}
