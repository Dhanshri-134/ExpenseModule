"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";
import { getPrefetchUrlsForRoute } from "@/features/dashboard/prefetch/config";
import { prefetchApiQueries } from "@/shared/query/api";

export function useDashboardRoutePrefetch() {
  const router = useRouter();

  useEffect(() => {
    const urls = getPrefetchUrlsForRoute(router.asPath);
    if (!urls.length) return undefined;

    let cancelled = false;
    const schedule =
      typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (callback) => window.setTimeout(callback, 200);
    const cancel =
      typeof window !== "undefined" && typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback
        : window.clearTimeout;

    const handle = schedule(() => {
      if (!cancelled) {
        // Keep hover/idle prefetch lightweight so hidden tabs do not build up avoidable network work.
        prefetchApiQueries(urls, { requireVisible: true, batchSize: 2, batchDelayMs: 100 }).catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      cancel(handle);
    };
  }, [router.asPath]);
}
