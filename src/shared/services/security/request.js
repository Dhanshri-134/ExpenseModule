import { canAccessModule, getRequestContext, hasRole } from "@/lib/server/authz";
import { sendError } from "@/shared/services/api/responses";

export async function requireApiContext(req, res, options = {}) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) {
    sendError(res, ctx.status, ctx.error);
    return null;
  }

  if (options.roles?.length && !hasRole(ctx, options.roles)) {
    sendError(res, 403, "forbidden");
    return null;
  }

  if (options.moduleKey && !canAccessModule(ctx, options.moduleKey)) {
    sendError(res, 403, "forbidden");
    return null;
  }

  return ctx;
}
