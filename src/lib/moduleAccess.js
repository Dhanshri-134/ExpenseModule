export const MODULE_ACCESS_KEYS = ["leads", "clients", "projects", "invoices", "estimates"];

export const MODULE_ACCESS_LABELS = {
  leads: "Leads",
  clients: "Clients",
  projects: "Projects",
  invoices: "Invoices",
  estimates: "Estimates",
};

export function buildDefaultModuleAccess(role = "employee") {
  if (role === "owner") {
    return {
      leads: true,
      clients: true,
      projects: true,
      invoices: true,
      estimates: true,
    };
  }

  return {
    leads: true,
    clients: true,
    projects: true,
    invoices: true,
    estimates: true,
  };
}

export function normalizeModuleAccess(input, role = "employee") {
  const fallback = buildDefaultModuleAccess(role);
  const source = input && typeof input === "object" ? input : {};
  const normalized = {};

  MODULE_ACCESS_KEYS.forEach((key) => {
    normalized[key] = role === "owner" ? true : Boolean(source[key] ?? fallback[key]);
  });

  return normalized;
}

export function canUseModule(moduleAccess, moduleKey) {
  if (!moduleKey) return true;
  return Boolean(moduleAccess?.[moduleKey]);
}
