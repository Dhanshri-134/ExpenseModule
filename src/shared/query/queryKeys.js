function buildUrl(basePath, entries = []) {
  const params = new URLSearchParams();
  entries.forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export const queryKeys = {
  dashboard: {
    summary: () => "/api/dashboard",
  },
  settings: {
    current: () => "/api/settings",
  },
  projects: {
    list: (params = {}) => buildUrl("/api/projects", [
      ["page", params.page],
      ["pageSize", params.pageSize],
    ]),
  },
  tasks: {
    list: (params = {}) => buildUrl("/api/tasks", [
      ["projectId", params.projectId],
      ["page", params.page],
      ["pageSize", params.pageSize],
    ]),
  },
  staff: {
    list: () => "/api/staff",
    preview: (role) => buildUrl("/api/staff", [["mode", "preview"], ["role", role]]),
  },
  leads: {
    list: (params = {}) => buildUrl("/api/leads", [
      ["page", params.page],
      ["pageSize", params.pageSize],
    ]),
  },
  followups: {
    list: (params = {}) => buildUrl("/api/followups", [
      ["filter", params.filter && params.filter !== "all" ? params.filter : undefined],
      ["refId", params.refId],
      ["refType", params.refType],
      ["status", params.status],
      ["page", params.page],
      ["pageSize", params.pageSize],
    ]),
  },
  clients: {
    list: () => "/api/clients",
  },
  expenses: {
    list: ({ projectId, filters = {}, page, pageSize } = {}) =>
      buildUrl("/api/project-expenses", [
        ["projectId", projectId],
        ["projectFilter", filters.projectId && filters.projectId !== "all" ? filters.projectId : undefined],
        ["search", filters.search],
        ["expenseType", filters.expenseType && filters.expenseType !== "all" ? filters.expenseType : undefined],
        ["status", filters.status && filters.status !== "all" ? filters.status : undefined],
        ["startDate", filters.startDate],
        ["endDate", filters.endDate],
        ["createdByUserId", filters.createdByUserId && filters.createdByUserId !== "all" ? filters.createdByUserId : undefined],
        ["page", page],
        ["pageSize", pageSize],
      ]),
  },
  estimates: {
    list: (params = {}) => buildUrl("/api/estimates", [
      ["id", params.id],
      ["projectId", params.projectId],
      ["clientId", params.clientId],
      ["compact", params.compact],
      ["page", params.page],
      ["pageSize", params.pageSize],
    ]),
    templates: () => "/api/estimate-templates",
  },
  fieldReports: {
    list: (projectId) => buildUrl("/api/field-reports", [["projectId", projectId]]),
  },
};
