import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { loadUserDirectory } from "@/lib/server/taskWorkflow";

const QuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (req.method !== "GET") return sendError(res, 405, "method_not_allowed");

  const parsed = QuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) return sendError(res, 400, "invalid_query", parsed.error.flatten());

  let query = ctx.admin
    .from("activity_logs")
    .select("id, company_id, project_id, task_id, actor_user_id, message, metadata, created_at")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (parsed.data.projectId) {
    query = query.eq("project_id", parsed.data.projectId);
  }

  if (parsed.data.taskId) {
    query = query.eq("task_id", parsed.data.taskId);
  }

  const { data, error } = await query;
  if (error) return sendError(res, 500, "activity_logs_fetch_failed", error.message);

  const visibleLogs = (data ?? []).filter((item) => {
    if (ctx.role === "owner") return true;
    return item.project_id ? ctx.projectIds.includes(item.project_id) : false;
  });

  const filteredLogs = parsed.data.userId
    ? visibleLogs.filter((item) => {
        const metadata = item.metadata ?? {};
        return (
          item.actor_user_id === parsed.data.userId ||
          metadata.user_id === parsed.data.userId ||
          metadata.assignee_user_id === parsed.data.userId ||
          metadata.approver_user_id === parsed.data.userId
        );
      })
    : visibleLogs;

  const directory = await loadUserDirectory(
    ctx.admin,
    ctx.company.id,
    filteredLogs.map((item) => item.actor_user_id).filter(Boolean)
  );

  return sendOk(res, {
    logs: filteredLogs.map((item) => ({
      ...item,
      actor: item.actor_user_id ? directory.get(item.actor_user_id) ?? null : null,
    })),
  });
}
