"use client";

import { useMemo } from "react";
import { useApiQuery } from "@/lib/client/apiQuery";
import { buildEnteredByOptions, buildExpenseMetrics } from "@/features/expenses/utils/expenseSelectors";
import { invalidateProjectExpenses } from "@/shared/query/invalidation";
import { queryKeys } from "@/shared/query/queryKeys";

export function useProjectExpenses({ projectId, filters, enabled = true, ttlMs } = {}) {
  const queryUrl = useMemo(
    () => queryKeys.expenses.list({ projectId, filters }),
    [filters, projectId]
  );
  const query = useApiQuery(queryUrl, {
    enabled,
    ttlMs,
  });

  const expenses = useMemo(() => query.data?.expenses ?? [], [query.data?.expenses]);
  const projects = useMemo(() => query.data?.projects ?? [], [query.data?.projects]);
  const expenseTypes = useMemo(() => query.data?.expenseTypes ?? [], [query.data?.expenseTypes]);
  const statusOptions = useMemo(() => query.data?.statusOptions ?? [], [query.data?.statusOptions]);
  const enteredByOptions = useMemo(() => buildEnteredByOptions(expenses), [expenses]);
  const totals = useMemo(() => buildExpenseMetrics(expenses, projects), [expenses, projects]);

  return {
    query,
    queryUrl,
    expenses,
    projects,
    expenseTypes,
    statusOptions,
    enteredByOptions,
    totals,
    invalidate: () => invalidateProjectExpenses(projectId),
  };
}
