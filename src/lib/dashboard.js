import {
  AccentSparkIcon,
  DashboardIcon,
  InsightsIcon,
  ProjectsIcon,
  TeamIcon,
  CalendarIcon,
  ReportIcon,
  ExpenseIcon,
  SettingsIcon
} from "@/components/dashboard/icons";
import { ROLE_LABELS, normalizeRole } from "@/lib/roles";

export const DASHBOARD_ROLE_META = {
  owner: {
    badge: "System Owner",
    accent: "Command Center",
    icon: AccentSparkIcon,
  },
  manager: {
    badge: " System Manager",
    accent: "Team Lead",
    icon: TeamIcon,
  },
  employee: {
    badge: "Workspace Member",
    accent: "Project Contributor",
    icon: ProjectsIcon,
  },
};

export const DASHBOARD_NAVIGATION = {
  owner: [
    { href: "/owner", label: "Overview", icon: DashboardIcon, match: /^\/owner$/ },
    {
      href: "/owner/projects",
      label: "Projects",
      icon: ProjectsIcon,
      match: /^\/owner\/projects/,
    },
    { href: "/owner/staff", label: "Staff", icon: TeamIcon, match: /^\/owner\/staff$/ },
    { href: "/owner/tasks", label: "Tasks", icon: InsightsIcon, match: /^\/owner\/tasks$/ },
    { href: "/owner/settings", label: "Settings", icon: SettingsIcon, match: /^\/owner\/settings$/ },
  ],
  manager: [
    { href: "/manager", label: "Overview", icon: DashboardIcon, match: /^\/manager$/ },
    { href: "/manager/projects", label: "Projects", icon: ProjectsIcon, match: /^\/manager\/projects/ },
    { href: "/manager/tasks", label: "Tasks", icon: InsightsIcon, match: /^\/manager\/tasks$/ },
    { href: "/manager/settings", label: "Settings", icon: SettingsIcon, match: /^\/manager\/settings$/ },
  ],
  employee: [
    { href: "/employee", label: "Overview", icon: DashboardIcon, match: /^\/employee$/ },
    { href: "/employee/projects", label: "Projects", icon: ProjectsIcon, match: /^\/employee\/projects$/ },
    { href: "/employee/tasks", label: "Tasks", icon: InsightsIcon, match: /^\/employee\/tasks$/ },
    { href: "/employee/settings", label: "Settings", icon: SettingsIcon, match: /^\/employee\/settings$/ },
  ],
};

export function getProjectNavigation(roleBase, projectId) {
  const base = `/${roleBase}/project/${projectId}`;

  if (roleBase === "owner") {
    return [
      { href: `${base}/overview`, label: "Overview", icon: DashboardIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/overview$`) },
      { href: `${base}/staff`, label: "Staff", icon: TeamIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/staff$`) },
      { href: `${base}/tasks`, label: "Tasks", icon: CalendarIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/tasks$`) },
      // { href: `${base}/reports`, label: "Reports", icon: ReportIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/reports$`) },
      // { href: `${base}/expenses`, label: "Expenses", icon: ExpenseIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/expenses$`) },
    ];
  }

  if (roleBase === "manager") {
    return [
      { href: `${base}/overview`, label: "Overview", icon: DashboardIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/overview$`) },
      { href: `${base}/staff`, label: "Staff", icon: TeamIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/staff$`) },
      { href: `${base}/tasks`, label: "Tasks", icon: CalendarIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/tasks$`) },
      // { href: `${base}/reports`, label: "Reports", icon: ReportIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/reports$`) },
    ];
  }

  return [
    { href: `${base}/overview`, label: "Overview", icon: DashboardIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/overview$`) },
    { href: `${base}/staff`, label: "Staff", icon: TeamIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/staff$`) },
    { href: `${base}/tasks`, label: "Tasks", icon: CalendarIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/tasks$`) },
  ];
}

function getInitials(name = "A C") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function buildDashboardViewer({
  id,
  name,
  email,
  role,
  avatarUrl = null,
  companyName,
}) {
  const safeRole = normalizeRole(role) || "owner";
  const fallbackName = companyName ? `${companyName} Admin` : ROLE_LABELS[safeRole] ?? "User";

  return {
    id,
    name: name || fallbackName,
    email: email || "",
    role: safeRole,
    roleLabel: ROLE_LABELS[safeRole] ?? "User",
    roleBadge: DASHBOARD_ROLE_META[safeRole]?.badge ?? "Workspace Member",
    avatarUrl,
    initials: getInitials(name || fallbackName),
  };
}
