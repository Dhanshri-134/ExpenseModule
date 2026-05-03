import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import {
  canManageTasks,
  formatRoleLabel,
  getTaskWorkspace,
  insertActivityLog,
  loadUserDirectory,
  normalizeProjectRole,
  PROJECT_ASSIGNABLE_ROLES,
  syncTaskStatus,
} from "@/lib/server/taskWorkflow";

const ProjectScopedQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

const CreateTaskSchema = z.object({
  projectId: z.string().uuid(),
  assigneeUserIds: z.array(z.string().uuid()).min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  approvalRole: z.enum(PROJECT_ASSIGNABLE_ROLES),
  approverUserId: z.string().uuid().optional().nullable(),
});

const UpdateTaskSchema = CreateTaskSchema.extend({
  id: z.string().uuid(),
});

const DeleteTaskSchema = z.object({
  id: z.string().uuid(),
});

async function loadProjectAssignments(ctx, projectId) {
  const { data, error } = await ctx.admin
    .from("project_users")
    .select("project_id, user_id, role")
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message || "project_assignments_fetch_failed");
  }

  return data ?? [];
}

function getAllowedAssigneeRole(ctx) {
  return ctx.role === "owner" ? ["manager", "employee"] : ["employee"];
}

async function validateAssignees(ctx, projectId, assigneeUserIds) {
  const projectAssignments = await loadProjectAssignments(ctx, projectId);
  const allowedRoles = new Set(getAllowedAssigneeRole(ctx));
  const selectedAssignments = projectAssignments.filter((assignment) =>
    assigneeUserIds.includes(assignment.user_id)
  );

  if (selectedAssignments.length !== assigneeUserIds.length) {
    throw new Error("task_assignee_must_be_project_member");
  }

  const invalidAssignment = selectedAssignments.find((assignment) => !allowedRoles.has(assignment.role));
  if (invalidAssignment) {
    throw new Error(ctx.role === "manager" ? "manager_can_only_assign_employee" : "invalid_task_assignee_role");
  }

  return selectedAssignments.map((assignment) => ({
    ...assignment,
    role: normalizeProjectRole(assignment.role),
  }));
}

async function validateApprover(ctx, projectId, approvalRole, approverUserId) {
  if (!approverUserId) return null;

  const projectAssignments = await loadProjectAssignments(ctx, projectId);
  const approverAssignment = projectAssignments.find((assignment) => assignment.user_id === approverUserId);
  if (!approverAssignment) {
    throw new Error("task_approver_must_be_project_member");
  }

  if (normalizeProjectRole(approverAssignment.role) !== normalizeProjectRole(approvalRole)) {
    throw new Error("task_approver_must_match_approval_role");
  }

  return approverUserId;
}

async function syncTaskAssignments(ctx, task, assigneeRows) {
  const { data: existingAssignments, error: existingError } = await ctx.admin
    .from("task_assignments")
    .select("id, task_id, user_id, role")
    .eq("task_id", task.id);

  if (existingError) {
    throw new Error(existingError.message || "task_assignments_fetch_failed");
  }

  const existingByUserId = new Map((existingAssignments ?? []).map((item) => [item.user_id, item]));
  const desiredUserIds = new Set(assigneeRows.map((item) => item.user_id));
  const missingAssignments = assigneeRows.filter((item) => !existingByUserId.has(item.user_id));
  const removableAssignments = (existingAssignments ?? []).filter((item) => !desiredUserIds.has(item.user_id));
  const updatableAssignments = assigneeRows.filter((item) => existingByUserId.has(item.user_id));

  if (missingAssignments.length) {
    const { error } = await ctx.admin.from("task_assignments").insert(
      missingAssignments.map((assignment) => ({
        task_id: task.id,
        project_id: task.project_id,
        user_id: assignment.user_id,
        role: assignment.role,
        assigned_by_user_id: ctx.user.id,
      }))
    );

    if (error) {
      throw new Error(error.message || "task_assignment_create_failed");
    }
  }

  for (const assignment of updatableAssignments) {
    const existing = existingByUserId.get(assignment.user_id);
    const { error } = await ctx.admin
      .from("task_assignments")
      .update({
        project_id: task.project_id,
        role: assignment.role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message || "task_assignment_update_failed");
    }
  }

  for (const assignment of removableAssignments) {
    const [{ data: submissions }, { data: approvals }] = await Promise.all([
      ctx.admin
        .from("task_submissions")
        .select("id")
        .eq("task_assignment_id", assignment.id)
        .limit(1),
      ctx.admin
        .from("task_approvals")
        .select("id")
        .eq("task_assignment_id", assignment.id)
        .limit(1),
    ]);

    if ((submissions ?? []).length || (approvals ?? []).length) {
      continue;
    }

    const { error } = await ctx.admin.from("task_assignments").delete().eq("id", assignment.id);
    if (error) {
      throw new Error(error.message || "task_assignment_delete_failed");
    }
  }
}

function canEditOrDeleteTask(ctx, task) {
  if (task.approver_user_id === ctx.user.id) return false;
  if (ctx.role === "owner") return true;
  return task.created_by === ctx.user.id;
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const parsed = ProjectScopedQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) return sendError(res, 400, "invalid_query", parsed.error.flatten());

    try {
      const workspace = await getTaskWorkspace(ctx.admin, ctx, { projectId: parsed.data.projectId ?? null });
      return sendOk(res, workspace);
    } catch (error) {
      return sendError(res, 500, "tasks_fetch_failed", error.message);
    }
  }

  if (req.method === "POST") {
    const parsed = CreateTaskSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const payload = parsed.data;
    if (!canManageTasks(ctx, payload.projectId)) return sendError(res, 403, "forbidden");

    try {
      const assigneeRows = await validateAssignees(ctx, payload.projectId, payload.assigneeUserIds);
      const approverUserId = await validateApprover(ctx, payload.projectId, payload.approvalRole, payload.approverUserId ?? null);
      const { data: task, error } = await ctx.admin
        .from("tasks")
        .insert({
          company_id: ctx.company.id,
          project_id: payload.projectId,
          title: payload.title,
          description: payload.description ?? null,
          start_date: payload.startDate,
          end_date: payload.endDate || null,
          approval_role: payload.approvalRole,
          approver_user_id: approverUserId,
          created_by: ctx.user.id,
          status: "assigned",
        })
        .select("*")
        .single();

      if (error || !task) return sendError(res, 500, "task_create_failed", error?.message);

      const { error: assignmentError } = await ctx.admin.from("task_assignments").insert(
        assigneeRows.map((assignment) => ({
          task_id: task.id,
          project_id: task.project_id,
          user_id: assignment.user_id,
          role: assignment.role,
          assigned_by_user_id: ctx.user.id,
        }))
      );

      if (assignmentError) return sendError(res, 500, "task_assignment_create_failed", assignmentError.message);
      await syncTaskStatus(ctx.admin, task.id);

      const [{ data: project }, directory] = await Promise.all([
        ctx.admin
          .from("projects")
          .select("id, name")
          .eq("id", task.project_id)
          .maybeSingle(),
        loadUserDirectory(ctx.admin, ctx.company.id, assigneeRows.map((item) => item.user_id)),
      ]);

      for (const assignment of assigneeRows) {
        const staff = directory.get(assignment.user_id) ?? null;
        await insertActivityLog(ctx.admin, {
          company_id: ctx.company.id,
          project_id: task.project_id,
          task_id: task.id,
          actor_user_id: ctx.user.id,
          message: `Task ${task.title} assigned to ${staff?.name || staff?.user_code || "Staff"} (${formatRoleLabel(assignment.role)})`,
          metadata: {
            type: "task_assignment",
            project_name: project?.name ?? null,
            assignee_user_id: assignment.user_id,
            assignee_role: assignment.role,
            approver_user_id: approverUserId,
          },
        });
      }

      return sendOk(res, { task });
    } catch (error) {
      return sendError(res, 400, error.message, error.message);
    }
  }

  if (req.method === "PUT") {
    const parsed = UpdateTaskSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const payload = parsed.data;
    const { data: existingTask } = await ctx.admin
      .from("tasks")
      .select("id, company_id, project_id, created_by, approver_user_id")
      .eq("id", payload.id)
      .maybeSingle();

    if (!existingTask) return sendError(res, 404, "task_not_found");
    if (!canManageTasks(ctx, existingTask.project_id)) return sendError(res, 403, "forbidden");
    if (!canManageTasks(ctx, payload.projectId)) return sendError(res, 403, "forbidden");
    if (!canEditOrDeleteTask(ctx, existingTask)) return sendError(res, 403, "forbidden");

    try {
      const assigneeRows = await validateAssignees(ctx, payload.projectId, payload.assigneeUserIds);
      const approverUserId = await validateApprover(ctx, payload.projectId, payload.approvalRole, payload.approverUserId ?? null);
      const { data: task, error } = await ctx.admin
        .from("tasks")
        .update({
          project_id: payload.projectId,
          title: payload.title,
          description: payload.description ?? null,
          start_date: payload.startDate,
          end_date: payload.endDate || null,
          approval_role: payload.approvalRole,
          approver_user_id: approverUserId,
        })
        .eq("id", payload.id)
        .eq("company_id", ctx.company.id)
        .select("*")
        .single();

      if (error || !task) return sendError(res, 500, "task_update_failed", error?.message);
      await syncTaskAssignments(ctx, task, assigneeRows);
      await syncTaskStatus(ctx.admin, task.id);
      return sendOk(res, { task });
    } catch (error) {
      return sendError(res, 400, error.message, error.message);
    }
  }

  if (req.method === "DELETE") {
    const parsed = DeleteTaskSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const { data: task } = await ctx.admin
      .from("tasks")
      .select("id, project_id, created_by, approver_user_id")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (!task) return sendError(res, 404, "task_not_found");
    if (!canManageTasks(ctx, task.project_id)) return sendError(res, 403, "forbidden");
    if (!canEditOrDeleteTask(ctx, task)) return sendError(res, 403, "forbidden");

    const { error } = await ctx.admin.from("tasks").delete().eq("id", parsed.data.id);
    if (error) return sendError(res, 500, "task_delete_failed", error.message);
    return sendOk(res, { deleted: true });
  }

  return sendError(res, 405, "method_not_allowed");
}
