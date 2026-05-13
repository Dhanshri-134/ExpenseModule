"use client";

import { useMemo } from "react";
import { useApiQuery } from "@/lib/client/apiQuery";
import { queryKeys } from "@/shared/query/queryKeys";

export function useProjectsList(options = {}) {
  const queryUrl = queryKeys.projects.list({
    page: options.page,
    pageSize: options.pageSize,
  });
  const query = useApiQuery(queryUrl, {
    enabled: options.enabled ?? true,
    ttlMs: options.ttlMs,
  });

  const projectList = useMemo(() => query.data?.projects ?? [], [query.data?.projects]);

  return {
    query,
    queryUrl,
    projectList,
    pagination: query.data?.pagination ?? null,
  };
}
