"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiQueryOptions } from "@/shared/query/client";
import { invalidateApiQueryKey, invalidateApiQueryPrefix as invalidateApiQueryPrefixKey, prefetchApiQuery, setApiQueryCacheData } from "@/shared/query/api";

export function invalidateApiQuery(key, options = {}) {
  return invalidateApiQueryKey(key, options);
}

export function invalidateApiQueryPrefix(prefix, options = {}) {
  return invalidateApiQueryPrefixKey(prefix, options);
}

export function setApiQueryData(key, nextValue) {
  if (!key) return;
  setApiQueryCacheData(key, nextValue);
}

export async function prefetchApiData(key, options = {}) {
  return prefetchApiQuery(key, options);
}

export function useApiQuery(key, options = {}) {
  const {
    enabled = Boolean(key),
    ttlMs,
    gcTime,
    refetchOnWindowFocus,
    refetchOnReconnect,
    refetchOnMount,
  } = options;
  const queryClient = useQueryClient();
  const emptySnapshot = {
    data: null,
    error: "",
    loading: false,
    refreshing: false,
    updatedAt: 0,
  };

  const query = useQuery({
    ...getApiQueryOptions(key || "", {
      staleTime: ttlMs,
      gcTime,
      refetchOnWindowFocus,
      refetchOnReconnect,
      refetchOnMount,
    }),
    enabled: Boolean(key) && enabled,
  });

  const refresh = useCallback(async () => {
    if (!key) return null;
    return queryClient.fetchQuery(getApiQueryOptions(key, {
      staleTime: ttlMs,
      gcTime,
      refetchOnWindowFocus,
      refetchOnReconnect,
      refetchOnMount,
    }));
  }, [gcTime, key, queryClient, refetchOnMount, refetchOnReconnect, refetchOnWindowFocus, ttlMs]);

  const setData = useCallback((nextValue) => {
    if (!key) return;
    setApiQueryCacheData(key, nextValue);
  }, [key]);

  if (!key) {
    return {
      ...emptySnapshot,
      refresh,
      setData,
    };
  }

  return {
    data: query.data ?? null,
    error: query.error?.message || "",
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isLoading,
    updatedAt: query.dataUpdatedAt || 0,
    refresh,
    setData,
  };
}
