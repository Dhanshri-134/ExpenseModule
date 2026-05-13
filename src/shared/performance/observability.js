"use client";

const PERF_BUFFER_LIMIT = 200;
const PERF_STORAGE_KEY = "acm:perf";

function canUseWindow() {
  return typeof window !== "undefined";
}

export function isPerformanceTrackingEnabled() {
  if (!canUseWindow()) return false;
  if (window.__ACM_PERF_ENABLED__ === true) return true;

  try {
    return window.localStorage?.getItem(PERF_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getPerfBuffer() {
  if (!canUseWindow()) return null;
  if (!Array.isArray(window.__ACM_PERF_SAMPLES__)) {
    window.__ACM_PERF_SAMPLES__ = [];
  }
  return window.__ACM_PERF_SAMPLES__;
}

export function recordPerformanceSample(name, durationMs, meta = {}) {
  if (!isPerformanceTrackingEnabled() || typeof performance === "undefined") return;
  const buffer = getPerfBuffer();
  if (!buffer) return;

  buffer.push({
    name,
    durationMs: Number(durationMs || 0),
    timestamp: Date.now(),
    ...meta,
  });

  if (buffer.length > PERF_BUFFER_LIMIT) {
    buffer.splice(0, buffer.length - PERF_BUFFER_LIMIT);
  }
}

export function measureSyncDuration(name, work, meta = {}) {
  if (!isPerformanceTrackingEnabled() || typeof performance === "undefined") {
    return work();
  }

  const startedAt = performance.now();
  const result = work();
  recordPerformanceSample(name, performance.now() - startedAt, meta);
  return result;
}

export async function measureAsyncDuration(name, work, meta = {}) {
  if (!isPerformanceTrackingEnabled() || typeof performance === "undefined") {
    return work();
  }

  const startedAt = performance.now();
  try {
    return await work();
  } finally {
    recordPerformanceSample(name, performance.now() - startedAt, meta);
  }
}

export function createInteractionMeasurement(name, meta = {}) {
  if (!isPerformanceTrackingEnabled() || typeof performance === "undefined") {
    return () => {};
  }

  const startedAt = performance.now();
  return () => {
    recordPerformanceSample(name, performance.now() - startedAt, meta);
  };
}
