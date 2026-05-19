"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export const EMPTY_ESTIMATE_PREVIEW_SUMMARY = Object.freeze({
  laborCost: 0,
  subcontractorCost: 0,
  materialCost: 0,
  equipmentCost: 0,
  directOverheadCost: 0,
  baseCost: 0,
  totalManHours: 0,
  totalDays: 0,
  finalBid: 0,
  totalPrice: 0,
});

export function useProjectEstimatePreview({ open, projectId, payload, initialSummary } = {}) {
  const [previewSummary, setPreviewSummary] = useState(initialSummary || EMPTY_ESTIMATE_PREVIEW_SUMMARY);
  const serializedPayload = useMemo(() => JSON.stringify(payload || {}), [payload]);
  const lastInitialSummaryRef = useRef(initialSummary);

  useEffect(() => {
    if (lastInitialSummaryRef.current === initialSummary || !initialSummary) return;
    lastInitialSummaryRef.current = initialSummary;
    setPreviewSummary(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    if (!open || !projectId) return undefined;

    const controller = new AbortController();
    let active = true;

    async function previewEstimate() {
      const res = await fetch("/api/estimates/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: serializedPayload,
        signal: controller.signal,
      }).catch(() => null);

      if (!res || !active) return;

      const json = await res.json().catch(() => null);
      if (!active) return;

      if (!res.ok) {
        setPreviewSummary(EMPTY_ESTIMATE_PREVIEW_SUMMARY);
        return;
      }

      setPreviewSummary(json?.summary || EMPTY_ESTIMATE_PREVIEW_SUMMARY);
    }

    previewEstimate();

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, projectId, serializedPayload]);

  return {
    previewSummary,
    setPreviewSummary,
  };
}
