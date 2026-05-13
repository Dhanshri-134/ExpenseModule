"use client";

import { QueryClient } from "@tanstack/react-query";
import { measureAsyncDuration } from "@/shared/performance/observability";
import { pooledGetJson } from "@/shared/services/api/client";

let browserQueryClient = null;

const DEFAULT_QUERY_POLICY = Object.freeze({
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  refetchOnMount: true,
});

const API_QUERY_POLICIES = [
  {
    match: (url) => url.startsWith("/api/settings"),
    policy: {
      staleTime: 2 * 60_000,
      gcTime: 15 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/dashboard"),
    policy: {
      staleTime: 45_000,
      gcTime: 10 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/estimate-templates"),
    policy: {
      staleTime: 10 * 60_000,
      gcTime: 20 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/clients"),
    policy: {
      staleTime: 90_000,
      gcTime: 15 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/projects"),
    policy: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/staff"),
    policy: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/tasks"),
    policy: {
      staleTime: 45_000,
      gcTime: 10 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/project-expenses"),
    policy: {
      staleTime: 45_000,
      gcTime: 10 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/followups"),
    policy: {
      staleTime: 45_000,
      gcTime: 10 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/leads"),
    policy: {
      staleTime: 45_000,
      gcTime: 10 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/field-reports"),
    policy: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/estimates?compact=1"),
    policy: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    },
  },
  {
    match: (url) => url.startsWith("/api/estimates"),
    policy: {
      staleTime: 45_000,
      gcTime: 10 * 60_000,
    },
  },
];

function shouldRetry(failureCount, error) {
  if (error?.status === 401 || error?.status === 403 || error?.status === 404) return false;
  return failureCount < 1;
}

export function getApiQueryKey(url) {
  return ["api", String(url || "")];
}

export function getApiQueryPolicy(url = "", options = {}) {
  const normalizedUrl = String(url || "");
  const matchedPolicy = API_QUERY_POLICIES.find((entry) => entry.match(normalizedUrl))?.policy || null;

  return {
    ...DEFAULT_QUERY_POLICY,
    ...(matchedPolicy || {}),
    ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)),
  };
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_QUERY_POLICY.staleTime,
        gcTime: DEFAULT_QUERY_POLICY.gcTime,
        refetchOnWindowFocus: DEFAULT_QUERY_POLICY.refetchOnWindowFocus,
        refetchOnReconnect: DEFAULT_QUERY_POLICY.refetchOnReconnect,
        refetchOnMount: DEFAULT_QUERY_POLICY.refetchOnMount,
        retry: shouldRetry,
      },
    },
  });
}

export function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }

  return browserQueryClient;
}

export function getApiQueryOptions(url, options = {}) {
  const policy = getApiQueryPolicy(url, {
    staleTime: options.staleTime,
    gcTime: options.gcTime,
    refetchOnWindowFocus: options.refetchOnWindowFocus,
    refetchOnReconnect: options.refetchOnReconnect,
    refetchOnMount: options.refetchOnMount,
  });

  return {
    queryKey: getApiQueryKey(url),
    queryFn: ({ signal }) =>
      measureAsyncDuration(
        "query.fetch",
        () => pooledGetJson(url, { signal }),
        { url: String(url || "") }
      ),
    staleTime: policy.staleTime,
    gcTime: policy.gcTime,
    refetchOnWindowFocus: policy.refetchOnWindowFocus,
    refetchOnReconnect: policy.refetchOnReconnect,
    refetchOnMount: policy.refetchOnMount,
  };
}
