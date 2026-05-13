"use client";

import { useMemo } from "react";
import { useApiQuery } from "@/lib/client/apiQuery";
import { invalidateDashboardSummary, invalidateTasksList } from "@/shared/query/invalidation";
import { queryKeys } from "@/shared/query/queryKeys";

const EMPTY_TASK_GROUPS = { tasks: [], assignedTasks: [], pendingApprovals: [], approvedByMe: [] };
const EMPTY_STAFF = { managers: [], employees: [], subcontractors: [] };

export function useTasksBoard({ fixedProjectId = "", ttlMs } = {}) {
  const tasksUrl = fixedProjectId ? queryKeys.tasks.list({ projectId: fixedProjectId }) : queryKeys.tasks.list();
  const tasksQuery = useApiQuery(tasksUrl, { ttlMs });
  const projectsQuery = useApiQuery(queryKeys.projects.list(), { ttlMs });
  const staffQuery = useApiQuery(queryKeys.staff.list(), { ttlMs });

  const taskGroups = useMemo(() => tasksQuery.data ?? EMPTY_TASK_GROUPS, [tasksQuery.data]);
  const projectList = useMemo(() => projectsQuery.data?.projects ?? [], [projectsQuery.data?.projects]);
  const staffData = useMemo(() => staffQuery.data?.staff ?? EMPTY_STAFF, [staffQuery.data?.staff]);

  async function refreshBoard({ refreshStaff = false } = {}) {
    await Promise.all([
      invalidateTasksList(fixedProjectId, { refetchType: "none" }),
      invalidateDashboardSummary(),
    ]);
    await Promise.all([
      tasksQuery.refresh(),
      refreshStaff ? staffQuery.refresh() : Promise.resolve(),
    ]);
  }

  return {
    tasksQuery,
    projectsQuery,
    staffQuery,
    taskGroups,
    projectList,
    staffData,
    refreshBoard,
  };
}
