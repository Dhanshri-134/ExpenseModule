"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_TTL_MS = 30_000;
const queryStore = new Map();

function createEntry() {
  return {
    data: null,
    error: "",
    updatedAt: 0,
    promise: null,
    listeners: new Set(),
  };
}

function getEntry(key) {
  if (!queryStore.has(key)) {
    queryStore.set(key, createEntry());
  }
  return queryStore.get(key);
}

function notify(entry) {
  entry.listeners.forEach((listener) => listener());
}

function getSnapshot(key) {
  const entry = getEntry(key);
  return {
    data: entry.data,
    error: entry.error,
    loading: Boolean(entry.promise) && entry.updatedAt === 0,
    refreshing: Boolean(entry.promise) && entry.updatedAt > 0,
    updatedAt: entry.updatedAt,
  };
}

async function runQuery(key, options = {}) {
  const { force = false, ttlMs = DEFAULT_TTL_MS, signal } = options;
  const entry = getEntry(key);
  const isFresh = entry.updatedAt && Date.now() - entry.updatedAt < ttlMs;

  if (!force) {
    if (entry.promise) return entry.promise;
    if (isFresh) return entry.data;
  }

  entry.promise = (async () => {
    try {
      const res = await fetch(key, { signal });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "request_failed");
      }
      entry.data = json;
      entry.error = "";
      entry.updatedAt = Date.now();
      notify(entry);
      return json;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw error;
      }
      entry.error = error?.message || "request_failed";
      notify(entry);
      throw error;
    } finally {
      entry.promise = null;
      notify(entry);
    }
  })();

  notify(entry);
  return entry.promise;
}

export function invalidateApiQuery(key) {
  if (!key) {
    queryStore.forEach((entry) => {
      entry.updatedAt = 0;
      notify(entry);
    });
    return;
  }

  const entry = queryStore.get(key);
  if (!entry) return;
  entry.updatedAt = 0;
  notify(entry);
}

export function setApiQueryData(key, nextValue) {
  const entry = getEntry(key);
  entry.data = typeof nextValue === "function" ? nextValue(entry.data) : nextValue;
  entry.error = "";
  entry.updatedAt = Date.now();
  notify(entry);
}

export function useApiQuery(key, options = {}) {
  const { enabled = Boolean(key), ttlMs = DEFAULT_TTL_MS } = options;
  const emptySnapshot = {
    data: null,
    error: "",
    loading: false,
    refreshing: false,
    updatedAt: 0,
  };
  const [snapshot, setSnapshot] = useState(() => (key ? getSnapshot(key) : {
    ...emptySnapshot,
  }));

  useEffect(() => {
    if (!key) return undefined;

    const entry = getEntry(key);
    const sync = () => setSnapshot(getSnapshot(key));
    entry.listeners.add(sync);
    sync();

    const controller = new AbortController();
    if (enabled) {
      runQuery(key, { ttlMs, signal: controller.signal }).catch((error) => {
        if (error?.name !== "AbortError") {
          sync();
        }
      });
    }

    return () => {
      controller.abort();
      entry.listeners.delete(sync);
    };
  }, [enabled, key, ttlMs]);

  const refresh = useCallback(async () => {
    if (!key) return null;
    return runQuery(key, { force: true, ttlMs });
  }, [key, ttlMs]);

  const setData = useCallback((nextValue) => {
    if (!key) return;
    setApiQueryData(key, nextValue);
  }, [key]);

  return {
    ...(key ? snapshot : emptySnapshot),
    setData,
    refresh,
  };
}
