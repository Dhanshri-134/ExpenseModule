import {
  AccentSparkIcon,
  ClientsIcon,
  DashboardIcon,
  InsightsIcon,
  LeadsIcon,
  ProjectsIcon,
  TeamIcon,
  CalendarIcon,
  ReportIcon,
  ExpenseIcon,
  SettingsIcon
} from "@/components/dashboard/icons";
import { ROLE_LABELS, normalizeRole } from "@/lib/roles";
import { canUseModule } from "@/lib/moduleAccess";

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
    { href: "/owner/leads", label: "Leads", icon: LeadsIcon, match: /^\/owner\/leads$/, moduleKey: "leads" },
    { href: "/owner/clients", label: "Clients", icon: ClientsIcon, match: /^\/owner\/clients$/, moduleKey: "clients" },
    { href: "/owner/estimates/", label: "Estimates", icon: ExpenseIcon, match: /^\/owner\/estimates$/, moduleKey: "estimates" },
    {
      href: "/owner/projects",
      label: "Projects",
      icon: ProjectsIcon,
      moduleKey: "projects",
      match: /^\/owner\/projects/,
    },
    { href: "/owner/invoicing", label: "Invoices", icon: ReportIcon, match: /^\/owner\/invoicing$/, moduleKey: "invoices" },
    { href: "/owner/expenses", label: "Expenses", icon: ExpenseIcon, match: /^\/owner\/expenses$/ },
    { href: "/owner/tasks", label: "Tasks", icon: InsightsIcon, match: /^\/owner\/tasks$/ },
    { href: "/owner/field-reports", label: "Field Reports", icon: ReportIcon, match: /^\/owner\/field-reports$/ },
    { href: "/owner/staff", label: "Staff", icon: TeamIcon, match: /^\/owner\/staff$/ },
    // { href: "/owner/followups", label: "Follow-ups", icon: CalendarIcon, match: /^\/owner\/followups$/ },
    { href: "/owner/time-tracking", label: "Time Tracking", icon: CalendarIcon, match: /^\/owner\/time-tracking$/ },
    { href: "/owner/settings", label: "Profile", icon: SettingsIcon, match: /^\/owner\/settings$/ },
  ],
  manager: [
    { href: "/manager", label: "Overview", icon: DashboardIcon, match: /^\/manager$/ },
    { href: "/manager/leads", label: "Leads", icon: LeadsIcon, match: /^\/manager\/leads$/, moduleKey: "leads" },
    { href: "/manager/clients", label: "Clients", icon: ClientsIcon, match: /^\/manager\/clients$/, moduleKey: "clients" },
    { href: "/manager/estimates", label: "Estimates", icon: ExpenseIcon, match: /^\/manager\/estimates/, moduleKey: "estimates" },
    { href: "/manager/projects", label: "Projects", icon: ProjectsIcon, match: /^\/manager\/projects/, moduleKey: "projects" },
    { href: "/manager/invoicing", label: "Invoices", icon: ReportIcon, match: /^\/manager\/invoicing/, moduleKey: "invoices" },
    { href: "/manager/expenses", label: "Expenses", icon: ExpenseIcon, match: /^\/manager\/expenses$/ },
    { href: "/manager/tasks", label: "Tasks", icon: InsightsIcon, match: /^\/manager\/tasks$/ },
    { href: "/manager/field-reports", label: "Field Reports", icon: ReportIcon, match: /^\/manager\/field-reports$/ },
    // { href: "/manager/followups", label: "Follow-ups", icon: CalendarIcon, match: /^\/manager\/followups$/ },
    { href: "/manager/time-tracking", label: "Time Tracking", icon: CalendarIcon, match: /^\/manager\/time-tracking$/ },
    { href: "/manager/settings", label: "Profile", icon: SettingsIcon, match: /^\/manager\/settings$/ },
  ],
  employee: [
    { href: "/employee", label: "Overview", icon: DashboardIcon, match: /^\/employee$/ },
    { href: "/employee/estimates", label: "Estimates", icon: ExpenseIcon, match: /^\/employee\/estimates/, moduleKey: "estimates" },
    { href: "/employee/projects", label: "Projects", icon: ProjectsIcon, match: /^\/employee\/projects$/, moduleKey: "projects" },
    { href: "/employee/invoicing", label: "Invoices", icon: ReportIcon, match: /^\/employee\/invoicing/, moduleKey: "invoices" },
    { href: "/employee/expenses", label: "Expenses", icon: ExpenseIcon, match: /^\/employee\/expenses$/ },
    { href: "/employee/tasks", label: "Tasks", icon: InsightsIcon, match: /^\/employee\/tasks$/ },
    { href: "/employee/field-reports", label: "Field Reports", icon: ReportIcon, match: /^\/employee\/field-reports$/ },
    // { href: "/employee/followups", label: "Follow-ups", icon: CalendarIcon, match: /^\/employee\/followups$/ },
    { href: "/employee/time-tracking", label: "Check In / Out", icon: CalendarIcon, match: /^\/employee\/time-tracking$/ },
    { href: "/employee/settings", label: "Profile", icon: SettingsIcon, match: /^\/employee\/settings$/ },
  ],
};

export function filterNavigationByAccess(navigation = [], moduleAccess = null) {
  return (navigation ?? []).filter((item) => canUseModule(moduleAccess, item.moduleKey));
}

export function filterNavigationForViewer(navigation = [], viewer = null) {
  const filtered = filterNavigationByAccess(navigation, viewer?.moduleAccess);
  return filtered.filter((item) => item.label === "Expenses");
}

export function getProjectNavigation(roleBase, projectId) {
  const base = `/${roleBase}/project/${projectId}`;

  if (roleBase === "owner") {
    return [
      { href: `/${roleBase}`, label: " Go To Main Dashboard", icon: DashboardIcon, match: new RegExp(`^/${roleBase}/`) },
      { href: `${base}/overview`, label: "Overview", icon: DashboardIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/overview$`) },
      { href: `${base}/staff`, label: "Staff", icon: TeamIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/staff$`) },
      { href: `${base}/tasks`, label: "Tasks", icon: CalendarIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/tasks$`) },
      { href: `${base}/estimates`, label: "Estimates", icon: ExpenseIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/estimates$`) },
      { href: `${base}/reports`, label: "Field Reports", icon: ReportIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/reports$`) },
    ];
  }

  if (roleBase === "manager") {
    return [
      { href: `${base}/overview`, label: "Overview", icon: DashboardIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/overview$`) },
      { href: `${base}/staff`, label: "Staff", icon: TeamIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/staff$`) },
      { href: `${base}/tasks`, label: "Tasks", icon: CalendarIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/tasks$`) },
      // { href: `${base}/estimates`, label: "Estimates", icon: ExpenseIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/estimates$`) },
      { href: `${base}/reports`, label: "Field Reports", icon: ReportIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/reports$`) },
    ];
  }

  return [
    { href: `${base}/overview`, label: "Overview", icon: DashboardIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/overview$`) },
    { href: `${base}/staff`, label: "Staff", icon: TeamIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/staff$`) },
    { href: `${base}/tasks`, label: "Tasks", icon: CalendarIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/tasks$`) },
    // { href: `${base}/estimates`, label: "Estimates", icon: ExpenseIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/estimates$`) },
    { href: `${base}/reports`, label: "Field Reports", icon: ReportIcon, match: new RegExp(`^/${roleBase}/project/${projectId}/reports$`) },
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
  userName,
  userCode,
  role,
  moduleAccess = null,
  avatarUrl = null,
  companyName,
  companyLogoUrl = "",
  onlyExpensesNav = false,
}) {
  const safeRole = normalizeRole(role) || "owner";
  const fallbackName = companyName ? `${companyName} Admin` : ROLE_LABELS[safeRole] ?? "User";

  return {
    id,
    name: name || fallbackName,
    email: email || "",
    userName: userName || userCode || "",
    userCode: userCode || "",
    role: safeRole,
    moduleAccess,
    roleLabel: ROLE_LABELS[safeRole] ?? "User",
    roleBadge: DASHBOARD_ROLE_META[safeRole]?.badge ?? "Workspace Member",
    avatarUrl,
    companyLogoUrl,
    onlyExpensesNav,
    initials: getInitials(name || fallbackName),
  };
}
