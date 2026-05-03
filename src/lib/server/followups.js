import { z } from "zod";
import { canAccessProject } from "@/lib/server/authz";
import { loadUserDirectory } from "@/lib/server/taskWorkflow";

export const FOLLOW_UP_REF_TYPES = ["lead", "client", "task"];
export const FOLLOW_UP_STATUSES = ["pending", "done"];

export const FollowUpInputSchema = z.object({
  refId: z.string().uuid(),
  refType: z.enum(FOLLOW_UP_REF_TYPES),
  date: z.string().min(1),
  note: z.string().trim().min(1),
  status: z.enum(FOLLOW_UP_STATUSES).default("pending"),
});

function normalizeFollowUpRow(row, createdByDirectory) {
  const createdBy = row?.created_by ? createdByDirectory.get(row.created_by) ?? null : null;

  return {
    ...row,
    createdBy: createdBy
      ? {
          id: createdBy.user_id,
          name: createdBy.name ?? "-",
          email: createdBy.email ?? "-",
          userName: createdBy.user_name ?? createdBy.user_code ?? "-",
        }
      : null,
  };
}

async function ensureReferenceAccess(ctx, refType, refId) {
  if (refType === "lead") {
    if (ctx.role !== "owner") throw new Error("forbidden");

    const { data: lead, error } = await ctx.admin
      .from("leads")
      .select("*")
      .eq("id", refId)
      .eq("company_id", ctx.company.id)
      .maybeSingle();

    if (error || !lead) throw new Error("lead_not_found");
    return { ref: lead, projectId: null };
  }

  if (refType === "client") {
    if (ctx.role !== "owner") throw new Error("forbidden");

    const { data: client, error } = await ctx.admin
      .from("clients")
      .select("*")
      .eq("id", refId)
      .eq("company_id", ctx.company.id)
      .maybeSingle();

    if (error || !client) throw new Error("client_not_found");
    return { ref: client, projectId: null };
  }

  const { data: task, error } = await ctx.admin
    .from("tasks")
    .select("*")
    .eq("id", refId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (error || !task) throw new Error("task_not_found");
  if (!canAccessProject(ctx, task.project_id)) throw new Error("forbidden");
  return { ref: task, projectId: task.project_id };
}

export async function createFollowUp(ctx, payload) {
  await ensureReferenceAccess(ctx, payload.refType, payload.refId);

  const { data, error } = await ctx.admin
    .from("followups")
    .insert({
      company_id: ctx.company.id,
      ref_id: payload.refId,
      ref_type: payload.refType,
      date: payload.date,
      note: payload.note,
      status: payload.status ?? "pending",
      created_by: ctx.user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "followup_create_failed");
  }

  const directory = await loadUserDirectory(ctx.admin, ctx.company.id, [data.created_by].filter(Boolean));
  return normalizeFollowUpRow(data, directory);
}

export async function listFollowUps(ctx, options = {}) {
  const query = ctx.admin
    .from("followups")
    .select("*")
    .eq("company_id", ctx.company.id)
    .order("date", { ascending: true })
    .order("created_at", { ascending: false });

  if (options.refType) query.eq("ref_type", options.refType);
  if (options.refId) query.eq("ref_id", options.refId);
  if (options.status) query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message || "followups_fetch_failed");

  let rows = data ?? [];

  if (ctx.role !== "owner") {
    const taskIds = [...new Set(rows.filter((row) => row.ref_type === "task").map((row) => row.ref_id))];
    const { data: tasks, error: taskError } = taskIds.length
      ? await ctx.admin.from("tasks").select("id, project_id").in("id", taskIds)
      : { data: [], error: null };

    if (taskError) throw new Error(taskError.message || "followup_tasks_fetch_failed");

    const taskProjectMap = new Map((tasks ?? []).map((task) => [task.id, task.project_id]));
    rows = rows.filter((row) => row.ref_type === "task" && canAccessProject(ctx, taskProjectMap.get(row.ref_id)));
  }

  if (options.filter === "today") {
    const today = new Date().toISOString().slice(0, 10);
    rows = rows.filter((row) => row.date === today && row.status !== "done");
  } else if (options.filter === "upcoming") {
    const today = new Date().toISOString().slice(0, 10);
    rows = rows.filter((row) => row.date >= today && row.status !== "done");
  } else if (options.filter === "completed") {
    rows = rows.filter((row) => row.status === "done");
  }

  const createdByIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean))];
  const directory = await loadUserDirectory(ctx.admin, ctx.company.id, createdByIds);

  return rows.map((row) => normalizeFollowUpRow(row, directory));
}
