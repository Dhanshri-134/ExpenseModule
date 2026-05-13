import { queryKeys } from "@/shared/query/queryKeys";

function withProjectId(url, projectId) {
  return projectId ? url.replace(":projectId", projectId) : null;
}

export function getPrefetchUrlsForHref(href = "") {
  if (href.endsWith("/projects")) {
    return [queryKeys.projects.list(), queryKeys.staff.list()];
  }
  if (href.endsWith("/tasks")) {
    return [queryKeys.tasks.list(), queryKeys.projects.list(), queryKeys.staff.list()];
  }
  if (href.endsWith("/estimates") || href.includes("/estimates/")) {
    return [queryKeys.estimates.list({ compact: 1 }), queryKeys.estimates.templates(), queryKeys.projects.list()];
  }
  if (href.endsWith("/invoicing")) {
    return [queryKeys.estimates.list({ compact: 1 }), queryKeys.settings.current(), queryKeys.clients.list()];
  }
  if (href.endsWith("/leads")) {
    return [queryKeys.leads.list(), queryKeys.followups.list()];
  }
  if (href.endsWith("/staff")) {
    return [queryKeys.staff.list(), queryKeys.projects.list()];
  }
  if (href.endsWith("/expenses")) {
    return [queryKeys.projects.list()];
  }
  if (href.endsWith("/settings")) {
    return [queryKeys.settings.current()];
  }
  if (href === "/owner" || href === "/manager" || href === "/employee") {
    return [queryKeys.dashboard.summary(), queryKeys.projects.list(), queryKeys.tasks.list(), queryKeys.estimates.list({ compact: 1 })];
  }
  return [];
}

export function getPrefetchUrlsForRoute(asPath = "") {
  const path = String(asPath || "").split("?")[0];
  const projectMatch = path.match(/^\/(owner|manager|employee)\/project\/([^/]+)\/(overview|tasks|staff|expenses|estimates|reports)$/);

  if (projectMatch) {
    const projectId = projectMatch[2];
    const section = projectMatch[3];

    if (section === "overview") {
      return [
        withProjectId(queryKeys.tasks.list({ projectId: ":projectId" }), projectId),
        withProjectId(queryKeys.expenses.list({ projectId: ":projectId" }), projectId),
        queryKeys.staff.list(),
      ];
    }

    if (section === "tasks") {
      return [withProjectId(queryKeys.tasks.list({ projectId: ":projectId" }), projectId), queryKeys.staff.list()];
    }

    if (section === "expenses") {
      return [withProjectId(queryKeys.expenses.list({ projectId: ":projectId" }), projectId)];
    }

    if (section === "estimates") {
      return [
        withProjectId(queryKeys.estimates.list({ projectId: ":projectId" }), projectId),
        queryKeys.estimates.templates(),
      ];
    }
  }

  if (path === "/owner" || path === "/manager" || path === "/employee") {
    return [queryKeys.projects.list(), queryKeys.tasks.list(), queryKeys.estimates.list({ compact: 1 })];
  }

  return [];
}
