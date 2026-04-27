import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { insertActivityLog } from "@/lib/server/taskWorkflow";

const TaskSubmissionSchema = z.object({
  taskAssignmentId: z.string().uuid(),
  workDescription: z.string().min(1),
  photos: z.array(z.string().min(1)).max(8).default([]),
  blocker: z.string().optional().nullable(),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (req.method !== "POST") return sendError(res, 405, "method_not_allowed");

  const parsed = TaskSubmissionSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

  const payload = parsed.data;
  const { data: assignment, error: assignmentError } = await ctx.admin
    .from("task_assignments")
    .select("id, task_id, project_id, user_id, status, tasks!inner(id, title, company_id)")
    .eq("id", payload.taskAssignmentId)
    .eq("tasks.company_id", ctx.company.id)
    .maybeSingle();

  if (assignmentError || !assignment) return sendError(res, 404, "task_assignment_not_found");
  if (assignment.user_id !== ctx.user.id) return sendError(res, 403, "forbidden");
  if (!["assigned", "rejected"].includes(assignment.status)) {
    return sendError(res, 400, "task_submission_locked");
  }

  const { data: submission, error: submissionError } = await ctx.admin
    .from("task_submissions")
    .insert({
      task_assignment_id: assignment.id,
      task_id: assignment.task_id,
      project_id: assignment.project_id,
      submitted_by_user_id: ctx.user.id,
      work_description: payload.workDescription,
      photos: payload.photos,
      blocker: payload.blocker ?? null,
    })
    .select("id, created_at")
    .single();

  if (submissionError || !submission) return sendError(res, 500, "task_submission_failed", submissionError?.message);

  const { error: statusError } = await ctx.admin
    .from("task_assignments")
    .update({
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignment.id);

  if (statusError) return sendError(res, 500, "task_assignment_status_failed", statusError.message);

  await insertActivityLog(ctx.admin, {
    company_id: ctx.company.id,
    project_id: assignment.project_id,
    task_id: assignment.task_id,
    actor_user_id: ctx.user.id,
    message: `Task submitted by ${ctx.viewer.name}`,
    metadata: {
      type: "task_submission",
      task_assignment_id: assignment.id,
      submission_id: submission.id,
    },
  });

  return sendOk(res, { submission });
}
