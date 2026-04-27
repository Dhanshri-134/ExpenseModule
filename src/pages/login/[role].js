import { ALLOWED_ROLES, normalizeRole } from "@/lib/roles";
import RoleLoginPanel from "@/components/auth/RoleLoginPanel";

export default function RoleLoginPage({ role }) {
  return <RoleLoginPanel role={role} />;
}

export async function getServerSideProps(ctx) {
  const role = normalizeRole(ctx.params?.role);
  if (!ALLOWED_ROLES.has(role)) {
    return { notFound: true };
  }
  return { props: { role } };
}

