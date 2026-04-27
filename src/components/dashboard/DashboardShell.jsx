"use client";

import { useState } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import styles from "@/components/dashboard/DashboardShell.module.css";

export default function DashboardShell({
  companyName,
  navigation,
  viewer,
  title,
  showBackButton = false,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <DashboardSidebar
          companyName={companyName}
          navigation={navigation}
          viewer={viewer}
          showBackButton={showBackButton}
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
