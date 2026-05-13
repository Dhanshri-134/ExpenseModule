"use client";

import { useMemo } from "react";
import { useApiQuery } from "@/lib/client/apiQuery";
import { invalidateDashboardSummary, invalidateFollowupsList } from "@/shared/query/invalidation";
import { queryKeys } from "@/shared/query/queryKeys";

export function useFollowupsPipeline({ filter = "all", ttlMs } = {}) {
  const followupsQuery = useApiQuery(queryKeys.followups.list({ filter }), { ttlMs });
  const leadsQuery = useApiQuery(queryKeys.leads.list(), { ttlMs });

  const leadById = useMemo(
    () => new Map((leadsQuery.data?.leads ?? []).map((lead) => [lead.id, lead])),
    [leadsQuery.data?.leads]
  );

  const groupedFollowups = useMemo(
    () =>
      (followupsQuery.data?.followUps ?? []).map((item) => ({
        ...item,
        lead: item.ref_type === "lead" ? leadById.get(item.ref_id) ?? null : null,
      })),
    [followupsQuery.data?.followUps, leadById]
  );

  return {
    followupsQuery,
    leadsQuery,
    groupedFollowups,
    leadById,
    invalidatePipeline: async () => {
      await invalidateFollowupsList(filter);
      await invalidateDashboardSummary();
    },
  };
}
