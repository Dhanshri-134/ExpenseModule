import { requirePageRole } from "@/lib/server/authz";

export async function requireRolePage(ctx, roles) {
  return requirePageRole(ctx, roles);
}

