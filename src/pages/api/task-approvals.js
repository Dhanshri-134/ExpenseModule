import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { canApproveTask, insertActivityLog, syncTaskStatus } from "@/lib/server/taskWorkflow";

const TaskApprovalSchema = z.object({
  taskAssignmentId: z.string().uuid(),
  action: z.enum(["approved", "rejected"]),
  comment: z.string().optional().nullable(),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (req.method !== "POST") return sendError(res, 405, "method_not_allowed");

  const parsed = TaskApprovalSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

  const payload = parsed.data;
  const { data: assignment, error: assignmentError } = await ctx.admin
    .from("task_assignments")
    .select("id, task_id, project_id, user_id, status")
    .eq("id", payload.taskAssignmentId)
    .maybeSingle();

  if (assignmentError || !assignment) return sendError(res, 404, "task_assignment_not_found");

  const { data: task, error: taskError } = await ctx.admin
    .from("tasks")
    .select("id, project_id, title, approval_role, approver_user_id, company_id")
    .eq("id", assignment.task_id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (taskError || !task) return sendError(res, 404, "task_not_found");
  if (!canApproveTask(ctx, task)) return sendError(res, 403, "forbidden");
  if (assignment.user_id === ctx.user.id) return sendError(res, 400, "self_approval_not_allowed");
  if (assignment.status !== "submitted") return sendError(res, 400, "task_review_unavailable");

  const { data: latestSubmission, error: latestSubmissionError } = await ctx.admin
    .from("task_submissions")
    .select("id")
    .eq("task_assignment_id", assignment.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSubmissionError || !latestSubmission) {
    return sendError(res, 404, "task_submission_not_found");
  }

  const { data: approval, error: approvalError } = await ctx.admin
    .from("task_approvals")
    .insert({
      task_submission_id: latestSubmission.id,
      task_assignment_id: assignment.id,
      task_id: assignment.task_id,
      project_id: assignment.project_id,
      action: payload.action,
      comment: payload.comment ?? null,
      approved_by_user_id: ctx.user.id,
      approved_by_role: ctx.role,
    })
    .select("id, action, created_at")
    .single();

  if (approvalError || !approval) return sendError(res, 500, "task_approval_failed", approvalError?.message);

  const { error: assignmentUpdateError } = await ctx.admin
    .from("task_assignments")
    .update({
      status: payload.action === "approved" ? "approved" : "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignment.id);

  if (assignmentUpdateError) return sendError(res, 500, "task_status_update_failed", assignmentUpdateError.message);
  await syncTaskStatus(ctx.admin, assignment.task_id);

  await insertActivityLog(ctx.admin, {
    company_id: ctx.company.id,
    project_id: assignment.project_id,
    task_id: assignment.task_id,
    actor_user_id: ctx.user.id,
    message:
      payload.action === "approved"
        ? `Task approved by ${ctx.viewer.name}`
        : `Task rejected by ${ctx.viewer.name}${payload.comment ? ` with comment: ${payload.comment}` : ""}`,
    metadata: {
      type: "task_approval",
      task_assignment_id: assignment.id,
      approval_id: approval.id,
      action: payload.action,
    },
  });

  return sendOk(res, { approval });
}
