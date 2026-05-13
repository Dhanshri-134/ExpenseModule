"use client";

import { useMemo } from "react";
import { useApiQuery } from "@/lib/client/apiQuery";
import { invalidateEstimateCollections } from "@/shared/query/invalidation";
import { queryKeys } from "@/shared/query/queryKeys";

export function useEstimateTemplates(ttlMs = 5 * 60_000) {
  const query = useApiQuery(queryKeys.estimates.templates(), { ttlMs });
  const templates = useMemo(() => query.data?.templates ?? query.data ?? [], [query.data]);
  const defaultTemplate = useMemo(
    () => templates.find((item) => item.is_default) || templates[0] || null,
    [templates]
  );

  return {
    query,
    templates,
    defaultTemplate,
    invalidateEstimates: invalidateEstimateCollections,
  };
}

export function useEstimateList({ standalone = false, ttlMs } = {}) {
  const queryUrl = standalone ? null : queryKeys.estimates.list({ compact: 1 });
  const query = useApiQuery(queryUrl, {
    enabled: !standalone,
    ttlMs,
  });
  const estimates = useMemo(() => query.data?.estimates ?? [], [query.data?.estimates]);
  return { query, estimates };
}

export function useEstimateDetail(estimateId, ttlMs) {
  const queryUrl = estimateId ? queryKeys.estimates.list({ id: estimateId }) : null;
  const query = useApiQuery(queryUrl, { enabled: Boolean(estimateId), ttlMs });
  const estimate = useMemo(() => query.data?.estimates?.[0] || null, [query.data?.estimates]);
  return { query, estimate };
}
