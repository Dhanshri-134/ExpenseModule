"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "@/styles/DashboardShell.module.css";

function NavItem({ item, active }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={[styles.navItem, active ? styles.navItemActive : ""].join(" ")}
    >
      <span className={styles.navIcon}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

function ViewerCard({ viewer }) {
  const hasPhoto = Boolean(viewer?.avatarUrl);

  return (
    <div className={styles.viewerCard}>
      <div className={styles.viewerRow}>
        <div className={styles.avatar}>
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewer.avatarUrl}
              alt={viewer.name}
              className={styles.avatarImage}
            />
          ) : (
            <>
              <Image
                src="/assets/logo.png"
                alt="ACM Desk logo"
                width={28}
                height={28}
                className="opacity-95"
              />
              <span className="sr-only">{viewer.initials}</span>
            </>
          )}
        </div>
        <div className={styles.viewerMeta}>
          <div className={styles.viewerName}>{viewer.name}</div>
          <div className={styles.roleBadge}>{viewer.roleBadge}</div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardSidebar({
  navigation,
  viewer,
  showBackButton,
  backHref,
  mobileOpen,
  onClose,
}) {
  const router = useRouter();
  const currentPath = router.asPath.split("?")[0];

  return (
    <>
      <div
        className={[
          styles.overlay,
          mobileOpen ? styles.overlayVisible : styles.overlayHidden,
        ].join(" ")}
        onClick={onClose}
      />

      <aside
        className={[
          styles.sidebar,
          mobileOpen ? styles.sidebarOpen : styles.sidebarClosed,
        ].join(" ")}
      >
        {showBackButton ? (
          <button
            type="button"
            onClick={() => router.push(backHref || `/${viewer?.role?.toLowerCase() || "login"}`)}
            className={styles.backButton}
          >
            Back
          </button>
        ) : null}

        <div className={styles.sidebarTop}>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
          >
            Close
          </button>
        </div>

        <ViewerCard viewer={viewer} />

        <nav className={styles.nav}>
          {navigation.map((item) => {
            const active = item.match ? item.match.test(currentPath) : currentPath === item.href;
            return <NavItem key={item.href} item={item} active={active} />;
          })}
        </nav>

        <div className={styles.footer}>Powered By Shris Tech</div>
      </aside>
    </>
  );
}
