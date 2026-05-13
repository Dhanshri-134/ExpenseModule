"use client";

import { invalidateApiQuery, invalidateApiQueryPrefix } from "@/lib/client/apiQuery";
import { queryKeys } from "@/shared/query/queryKeys";

async function invalidateMany(urls = [], options = {}) {
  await Promise.all(urls.filter(Boolean).map((url) => invalidateApiQuery(url, options)));
}

async function invalidateByPrefix(prefixes = [], options = {}) {
  await Promise.all(prefixes.filter(Boolean).map((prefix) => invalidateApiQueryPrefix(prefix, options)));
}

export function invalidateDashboardSummary(options = {}) {
  return invalidateApiQuery(queryKeys.dashboard.summary(), options);
}

export function invalidateProjectsList(options = {}) {
  return invalidateApiQueryPrefix("/api/projects", options);
}

export function invalidateTasksList(projectId, options = {}) {
  return invalidateByPrefix([
    projectId ? queryKeys.tasks.list({ projectId }) : queryKeys.tasks.list(),
    queryKeys.tasks.list(),
  ], options);
}

export function invalidateProjectExpenses(projectId, options = {}) {
  return invalidateByPrefix([
    projectId ? queryKeys.expenses.list({ projectId }) : null,
    queryKeys.expenses.list(),
    "/api/project-expenses",
  ], options);
}

export function invalidateEstimateCollections(projectId = null, options = {}) {
  return invalidateByPrefix([
    projectId ? queryKeys.estimates.list({ projectId }) : null,
    queryKeys.estimates.list(),
  ], options);
}

export function invalidateFollowupsList(filter = null, options = {}) {
  return invalidateByPrefix([
    filter ? queryKeys.followups.list({ filter }) : null,
    queryKeys.followups.list(),
  ], options);
}
