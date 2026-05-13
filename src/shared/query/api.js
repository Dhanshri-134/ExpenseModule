"use client";

import { getApiQueryOptions, getApiQueryKey, getQueryClient } from "@/shared/query/client";

function uniqueUrls(urls = []) {
  return Array.from(new Set(urls.filter(Boolean).map((url) => String(url))));
}

function isDocumentHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function prefetchApiQuery(url, options = {}) {
  if (!url) return null;
  const queryClient = getQueryClient();
  return queryClient.prefetchQuery(getApiQueryOptions(url, options));
}

export async function prefetchApiQueries(urls = [], options = {}) {
  const {
    batchSize = 2,
    batchDelayMs = 80,
    requireVisible = false,
    ...queryOptions
  } = options;
  const normalizedBatchSize = Math.max(batchSize, 1);
  const queue = uniqueUrls(urls);

  for (let index = 0; index < queue.length; index += normalizedBatchSize) {
    if (requireVisible && isDocumentHidden()) break;

    const batch = queue.slice(index, index + normalizedBatchSize);
    await Promise.allSettled(batch.map((url) => prefetchApiQuery(url, queryOptions)));

    if (batchDelayMs > 0 && index + normalizedBatchSize < queue.length && typeof window !== "undefined") {
      await wait(batchDelayMs);
    }
  }
}

export function invalidateApiQueryKey(url, options = {}) {
  const queryClient = getQueryClient();
  const refetchType = options.refetchType ?? "active";

  if (!url) {
    return queryClient.invalidateQueries({ queryKey: ["api"], refetchType });
  }
  return queryClient.invalidateQueries({ queryKey: getApiQueryKey(url), exact: true, refetchType });
}

export function invalidateApiQueryPrefix(prefix, options = {}) {
  const queryClient = getQueryClient();
  const normalizedPrefix = String(prefix || "");
  const refetchType = options.refetchType ?? "active";

  if (!normalizedPrefix) {
    return queryClient.invalidateQueries({ queryKey: ["api"], refetchType });
  }

  return queryClient.invalidateQueries({
    refetchType,
    predicate: (query) =>
      query.queryKey?.[0] === "api" &&
      typeof query.queryKey?.[1] === "string" &&
      query.queryKey[1].startsWith(normalizedPrefix),
  });
}

export function setApiQueryCacheData(url, nextValue) {
  const queryClient = getQueryClient();
  queryClient.setQueryData(getApiQueryKey(url), (current) =>
    typeof nextValue === "function" ? nextValue(current) : nextValue
  );
}
