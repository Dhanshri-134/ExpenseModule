import { z } from "zod";
import { canAccessProject, getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { formatRoleLabel, insertActivityLog, loadUserDirectory } from "@/lib/server/taskWorkflow";

const AssignmentSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["manager", "employee", "subcontractor"]),
  hourlyRate: z.coerce.number().nonnegative().default(0),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method !== "POST") return sendError(res, 405, "method_not_allowed");

  const parsed = AssignmentSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

  const payload = parsed.data;
  if (!canAccessProject(ctx, payload.projectId)) return sendError(res, 403, "forbidden");
  if (ctx.role === "manager" && payload.role !== "employee" && payload.role !== "subcontractor") {
    return sendError(res, 403, "manager_can_only_assign_employee");
  }

  const { data: targetMembership } = await ctx.admin
    .from("company_users")
    .select("company_id, user_id, role")
    .eq("company_id", ctx.company.id)
    .eq("user_id", payload.userId)
    .maybeSingle();

  if (!targetMembership) return sendError(res, 404, "staff_not_found");
  if (targetMembership.role === "owner") return sendError(res, 400, "owner_cannot_be_project_assigned");
  if (ctx.role === "manager" && targetMembership.role !== "employee" && targetMembership.role !== "subcontractor") {
    return sendError(res, 403, "manager_can_only_assign_employee");
  }

  const { data: assignment, error } = await ctx.admin
    .from("project_users")
    .upsert({
      project_id: payload.projectId,
      user_id: payload.userId,
      role: payload.role,
      hourly_rate: payload.hourlyRate,
    })
    .select("project_id, user_id, role, hourly_rate")
    .single();

  if (error || !assignment) return sendError(res, 500, "assignment_failed", error?.message);

  const [{ data: project }, directory] = await Promise.all([
    ctx.admin.from("projects").select("id, name").eq("id", payload.projectId).maybeSingle(),
    loadUserDirectory(ctx.admin, ctx.company.id, [payload.userId]),
  ]);

  const staff = directory.get(payload.userId) ?? null;
  const message = `${project?.name || "Project"} is assigned to ${staff?.name || staff?.user_code || "Staff"} (${formatRoleLabel(payload.role)})`;

  await insertActivityLog(ctx.admin, {
    company_id: ctx.company.id,
    project_id: payload.projectId,
    actor_user_id: ctx.user.id,
    message,
    metadata: {
      type: "project_assignment",
      user_id: payload.userId,
      role: payload.role,
      hourly_rate: payload.hourlyRate,
    },
  });

  return sendOk(res, { assignment, message });
}
