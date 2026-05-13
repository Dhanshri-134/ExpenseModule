"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { getPrefetchUrlsForHref } from "@/features/dashboard/prefetch/config";
import { prefetchApiQueries } from "@/shared/query/api";
import styles from "@/styles/DashboardShell.module.css";

function NavItem({ item, active, onPrefetch }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={[styles.navItem, active ? styles.navItemActive : ""].join(" ")}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
    >
      <span className={styles.navIcon}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

function ViewerCard({ viewer, logo }) {
  const hasPhoto = Boolean(logo);

  return (
    <div className={styles.viewerCard}>
      <div className={styles.viewerRow}>
        <div className={styles.avatar}>
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={viewer.name}
              className={styles.avatarImage}
            />
          ) : (
            <span aria-hidden="true" className="text-sm font-bold text-[color:var(--acm-fg)]">
              {viewer.initials}
            </span>
          )}
        </div>
        <div className={styles.viewerMeta}>
          <div className={styles.viewerName}>{viewer.name}</div>
          <div className={styles.viewerSubline}>User Name: {viewer.userName || "-"}</div>
          <div className={styles.viewerSubline}>User ID: {viewer.userCode || "-"}</div>
          <div className={styles.roleBadge}>{viewer.roleBadge}</div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardSidebar({
  companyName,
  navigation,
  viewer,
  showBackButton,
  backHref,
  mobileOpen,
  onClose,
}) {
  const router = useRouter();
  const currentPath = router.asPath.split("?")[0];
  const sidebarLogo = viewer?.companyLogoUrl || "/assets/logo.png";

  async function prefetchNavigationTarget(item) {
    router.prefetch(item.href).catch(() => {});
    const urls = getPrefetchUrlsForHref(item.href);
    if (!urls.length) return;
    await prefetchApiQueries(urls);
  }

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
        {/* {showBackButton ? (
          <button
            type="button"
            onClick={() => router.push(backHref || `/${viewer?.role?.toLowerCase() || "login"}`)}
            className={styles.backButton}
          >
            Back
          </button>
        ) : null} */}

        {/* <div className={styles.sidebarTop}>
          <div className="flex items-center">
            <img
              src={sidebarLogo}
              alt={`${companyName || "Company"} logo`}
              className="h-12 w-auto max-w-[180px] object-contain"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
          >
            Close
          </button>
        </div> */}

        <ViewerCard viewer={viewer} logo={sidebarLogo} />

        <nav className={styles.nav}>
          {navigation.map((item) => {
            const active = item.match ? item.match.test(currentPath) : currentPath === item.href;
            return (
              <NavItem
                key={item.href}
                item={item}
                active={active}
                onPrefetch={() => {
                  prefetchNavigationTarget(item).catch(() => {});
                }}
              />
            );
          })}
        </nav>

        <div className={styles.footer}>Powered By Shris Tech</div>
      </aside>
    </>
  );
}
