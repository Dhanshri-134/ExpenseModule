"use client";

import { useMeasuredMemo } from "@/shared/performance/useMeasuredMemo";
import { buildDashboardOverviewAnalytics } from "@/features/dashboard/utils/overviewSelectors";

export function useDashboardOverviewAnalytics({ dashboardData, estimatesData, roleBase }) {
  return useMeasuredMemo(
    "dashboard.overview.analytics",
    () => buildDashboardOverviewAnalytics({ dashboardData, estimatesData, roleBase }),
    [dashboardData, estimatesData, roleBase],
    { area: "dashboard-overview" }
  );
}
