import { ALLOWED_ROLES, normalizeRole } from "@/lib/roles";
import RoleLoginPanel from "@/components/auth/RoleLoginPanel";

export default function RoleLoginPage({ role }) {
  return <RoleLoginPanel role={role} />;
}

function resolveRole(ctx, explicitRole) {
  if (explicitRole) return normalizeRole(explicitRole);
  if (ctx.params?.role) return normalizeRole(ctx.params.role);
  if (ctx.query?.role) return normalizeRole(ctx.query.role);

  const path = typeof ctx.resolvedUrl === "string" ? ctx.resolvedUrl.split("?")[0] : "";
  const match = path.match(/\/login\/([^/]+)$/);
  return normalizeRole(match?.[1] ?? "");
}

export async function getRoleLoginPageProps(ctx, explicitRole = "") {
  const role = resolveRole(ctx, explicitRole);
  if (!ALLOWED_ROLES.has(role)) {
    return { notFound: true };
  }

  return { props: { role } };
}
