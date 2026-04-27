export const ROLE_LABELS = {
  owner: "Owner",
  manager: "Manager",
  employee: "Employee",
};

export const ALLOWED_ROLES = new Set(Object.keys(ROLE_LABELS));

export function normalizeRole(value) {
  if (typeof value !== "string") return "";
  return value.toLowerCase();
}

