"use client";

import { useEffect, useMemo } from "react";
import { isPerformanceTrackingEnabled, measureSyncDuration, recordPerformanceSample } from "@/shared/performance/observability";

export function useMeasuredMemo(name, factory, deps, meta = {}) {
  // This helper intentionally accepts feature-owned dependency arrays so callers
  // can keep derivation ownership local without duplicating instrumentation code.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => measureSyncDuration(name, factory, meta), deps);
}

export function useRenderMetric(name, meta = {}) {
  const enabled = isPerformanceTrackingEnabled();
  const renderStartedAt = enabled && typeof performance !== "undefined" ? performance.now() : 0;

  useEffect(() => {
    if (!renderStartedAt || typeof performance === "undefined") return;
    recordPerformanceSample(name, performance.now() - renderStartedAt, { phase: "render", ...meta });
  });
}
