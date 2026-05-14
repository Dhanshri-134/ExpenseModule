import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import {
  canManageTimesheets,
  formatDateInTimeZone,
  formatMinutes,
  logTimesheetActivity,
  normalizeTimeZone,
  recomputeWeeklyOvertime,
  weekBoundsForDate,
} from "@/lib/server/timeTracking";
import { loadUserDirectory } from "@/lib/server/taskWorkflow";

const QuerySchema = z.object({
  weekOf: z.string().optional(),
  userId: z.string().uuid().optional(),
  timeZone: z.string().optional(),
});

const ClockInSchema = z.object({
  action: z.literal("clock_in"),
  userId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional().nullable(),
  overheadLabel: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  clockIn: z.string().optional(),
  timeZone: z.string().optional(),
});

const ClockOutSchema = z.object({
  action: z.literal("clock_out"),
  id: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  breakMinutes: z.coerce.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  clockOut: z.string().optional(),
  timeZone: z.string().optional(),
});

const UpdateEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional().nullable(),
  overheadLabel: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  clockIn: z.string(),
  clockOut: z.string().nullable().optional(),
  breakMinutes: z.coerce.number().min(0).default(0),
  timeZone: z.string().optional(),
});

const DeleteEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  timeZone: z.string().optional(),
});

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function canManageTargetUser(ctx, targetUserId) {
  if (!targetUserId || targetUserId === ctx.user.id) return true;
  if (ctx.role === "owner") return true;
  if (ctx.role !== "manager") return false;

  const managedProjectIds = ctx.projectAssignments.filter((item) => item.role === "manager").map((item) => item.project_id);
  if (!managedProjectIds.length) return false;

  const { data } = await ctx.admin
    .from("project_users")
    .select("project_id")
    .eq("user_id", targetUserId)
    .in("project_id", managedProjectIds)
    .limit(1);

  return Boolean(data?.length);
}

function summarizeEntries(entries = []) {
  const dailyMap = new Map();
  const projectMap = new Map();
  const overheadMap = new Map();
  const employeeMap = new Map();

  let weeklyMinutes = 0;
  let overtimeMinutes = 0;

  for (const entry of entries) {
    const payableMinutes = toNumber(entry.payable_minutes);
    const overtimeEntryMinutes = toNumber(entry.overtime_minutes);
    weeklyMinutes += payableMinutes;
    overtimeMinutes += overtimeEntryMinutes;

    const dayKey = entry.entry_date;
    dailyMap.set(dayKey, {
      date: dayKey,
      minutes: (dailyMap.get(dayKey)?.minutes || 0) + payableMinutes,
      entries: (dailyMap.get(dayKey)?.entries || 0) + 1,
    });

    if (entry.project_id) {
      const projectKey = entry.project_id;
      projectMap.set(projectKey, {
        project_id: projectKey,
        project_name: entry.project?.name || "Project",
        minutes: (projectMap.get(projectKey)?.minutes || 0) + payableMinutes,
      });
    } else {
      const overheadKey = entry.overhead_label || "Overhead";
      overheadMap.set(overheadKey, {
        label: overheadKey,
        minutes: (overheadMap.get(overheadKey)?.minutes || 0) + payableMinutes,
      });
    }

    const employeeKey = entry.user_id;
    employeeMap.set(employeeKey, {
      user_id: employeeKey,
      name: entry.staff?.name || entry.staff?.user_name || entry.staff?.user_code || "Staff",
      minutes: (employeeMap.get(employeeKey)?.minutes || 0) + payableMinutes,
      overtime_minutes: (employeeMap.get(employeeKey)?.overtime_minutes || 0) + overtimeEntryMinutes,
    });
  }

  return {
    weeklyMinutes,
    overtimeMinutes,
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    projects: [...projectMap.values()].sort((a, b) => b.minutes - a.minutes),
    overhead: [...overheadMap.values()].sort((a, b) => b.minutes - a.minutes),
    employees: [...employeeMap.values()].sort((a, b) => b.minutes - a.minutes),
  };
}

async function loadTimeTrackingPayload(ctx, weekOf, targetUserId, timeZone = "UTC") {
  const resolvedTimeZone = normalizeTimeZone(timeZone);
  const bounds = weekBoundsForDate(weekOf || new Date(), resolvedTimeZone);

  const visibleUserIds = new Set([ctx.user.id]);
  if (ctx.role === "owner") {
    const { data: everyone } = await ctx.admin
      .from("company_users")
      .select("user_id")
      .eq("company_id", ctx.company.id);
    (everyone ?? []).forEach((item) => visibleUserIds.add(item.user_id));
  } else if (ctx.role === "manager") {
    const managedProjectIds = ctx.projectAssignments.filter((item) => item.role === "manager").map((item) => item.project_id);
    if (managedProjectIds.length) {
      const { data: assignments } = await ctx.admin
        .from("project_users")
        .select("user_id")
        .in("project_id", managedProjectIds);
      (assignments ?? []).forEach((item) => visibleUserIds.add(item.user_id));
    }
  }

  const effectiveUserId = targetUserId && visibleUserIds.has(targetUserId) ? targetUserId : ctx.user.id;
  const userIds = [...visibleUserIds];

  const [entriesResult, activeResult, staffDirectory, projectsResult, auditResult] = await Promise.all([
    ctx.admin
      .from("time_clock_entries")
      .select("*")
      .eq("company_id", ctx.company.id)
      .in("user_id", userIds)
      .gte("entry_date", bounds.startDate)
      .lte("entry_date", bounds.endDate)
      .order("clock_in", { ascending: false }),
    ctx.admin
      .from("time_clock_entries")
      .select("*")
      .eq("company_id", ctx.company.id)
      .is("clock_out", null)
      .in("user_id", userIds)
      .order("clock_in", { ascending: true }),
    loadUserDirectory(ctx.admin, ctx.company.id, userIds),
    ctx.admin
      .from("projects")
      .select("id, name, job_number")
      .eq("company_id", ctx.company.id)
      .order("name", { ascending: true }),
    ctx.admin
      .from("activity_logs")
      .select("id, actor_user_id, created_at, message, metadata")
      .eq("company_id", ctx.company.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (entriesResult.error) return { error: entriesResult.error.message || "time_entries_fetch_failed" };
  if (activeResult.error) return { error: activeResult.error.message || "active_entries_fetch_failed" };

  const projectsById = new Map((projectsResult.data ?? []).map((project) => [project.id, project]));
  const entries = (entriesResult.data ?? []).map((entry) => ({
    ...entry,
    project: entry.project_id ? projectsById.get(entry.project_id) || null : null,
    staff: staffDirectory.get(entry.user_id) || null,
  }));

  const currentUserEntries = entries.filter((entry) => entry.user_id === effectiveUserId);
  const currentUserSummary = summarizeEntries(currentUserEntries);
  const dailyKey = formatDateInTimeZone(new Date(), resolvedTimeZone);
  const todayMinutes = currentUserEntries
    .filter((entry) => entry.entry_date === dailyKey)
    .reduce((sum, entry) => sum + toNumber(entry.payable_minutes), 0);

  const summaries = summarizeEntries(entries);
  const activeStaff = (activeResult.data ?? []).map((entry) => ({
    ...entry,
    project: entry.project_id ? projectsById.get(entry.project_id) || null : null,
    staff: staffDirectory.get(entry.user_id) || null,
  }));
  const currentEntry = activeStaff.find((entry) => entry.user_id === effectiveUserId) || null;
  const auditLogs = (auditResult.data ?? [])
    .filter((item) => item.metadata?.type === "timesheet")
    .map((item) => ({
      ...item,
      actor: item.actor_user_id ? staffDirectory.get(item.actor_user_id) || null : null,
    }));

  return {
    week: bounds,
    canManage: ctx.role === "owner" || ctx.role === "manager",
    activeStaff,
    currentEntry,
    projects: projectsResult.data ?? [],
    staff: [...staffDirectory.values()],
    entries: currentUserEntries,
    dailySummary: currentUserSummary.daily,
    weeklySummary: {
      minutes: currentUserEntries.reduce((sum, entry) => sum + toNumber(entry.payable_minutes), 0),
      overtimeMinutes: currentUserEntries.reduce((sum, entry) => sum + toNumber(entry.overtime_minutes), 0),
      todayMinutes,
    },
    projectSummary: currentUserSummary.projects,
    overheadSummary: currentUserSummary.overhead,
    employeeTotals: summaries.employees,
    auditLogs,
    selectedUserId: effectiveUserId,
    timeZone: resolvedTimeZone,
  };
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, "invalid_query", parsed.error.flatten());

    if (!(await canManageTargetUser(ctx, parsed.data.userId || ctx.user.id))) {
      return sendError(res, 403, "forbidden");
    }

    const payload = await loadTimeTrackingPayload(ctx, parsed.data.weekOf, parsed.data.userId, parsed.data.timeZone);
    if (payload.error) return sendError(res, 500, payload.error);
    return sendOk(res, payload);
  }

  if (req.method === "POST") {
    const parsed = z.discriminatedUnion("action", [ClockInSchema, ClockOutSchema]).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const payload = parsed.data;
    const timeZone = normalizeTimeZone(payload.timeZone);
    const targetUserId = payload.userId || ctx.user.id;
    if (!(await canManageTargetUser(ctx, targetUserId))) return sendError(res, 403, "forbidden");

    if (payload.action === "clock_in") {
      const { data: openEntry } = await ctx.admin
        .from("time_clock_entries")
        .select("id")
        .eq("company_id", ctx.company.id)
        .eq("user_id", targetUserId)
        .is("clock_out", null)
        .maybeSingle();

      if (openEntry?.id) return sendError(res, 400, "active_clock_entry_exists");

      const clockIn = payload.clockIn || new Date().toISOString();
      const { data: entry, error } = await ctx.admin
        .from("time_clock_entries")
        .insert({
          company_id: ctx.company.id,
          user_id: targetUserId,
          entry_date: formatDateInTimeZone(clockIn, timeZone),
          project_id: payload.projectId || null,
          clock_in: clockIn,
          work_type: payload.projectId ? "project" : "overhead",
          overhead_label: payload.projectId ? null : payload.overheadLabel || "Overhead",
          notes: payload.notes || null,
          is_manual: targetUserId !== ctx.user.id,
          edited_by_user_id: targetUserId !== ctx.user.id ? ctx.user.id : null,
          edited_at: targetUserId !== ctx.user.id ? new Date().toISOString() : null,
        })
        .select("*")
        .single();

      if (error || !entry) return sendError(res, 500, "clock_in_failed", error?.message);

      await recomputeWeeklyOvertime(ctx.admin, {
        companyId: ctx.company.id,
        userId: targetUserId,
        referenceDate: clockIn,
        timeZone,
      });
      await logTimesheetActivity(ctx.admin, ctx, "Clocked in", {
        entry_id: entry.id,
        subject_user_id: targetUserId,
        project_id: payload.projectId || null,
      });
    } else {
      let entryId = payload.id || "";
      if (!entryId) {
        const { data: openEntry } = await ctx.admin
          .from("time_clock_entries")
          .select("id")
          .eq("company_id", ctx.company.id)
          .eq("user_id", targetUserId)
          .is("clock_out", null)
          .maybeSingle();
        entryId = openEntry?.id || "";
      }

      if (!entryId) return sendError(res, 404, "active_clock_entry_not_found");

      const clockOut = payload.clockOut || new Date().toISOString();
      const { data: existing } = await ctx.admin
        .from("time_clock_entries")
        .select("id, project_id, notes, clock_in")
        .eq("company_id", ctx.company.id)
        .eq("id", entryId)
        .maybeSingle();

      const { error } = await ctx.admin
        .from("time_clock_entries")
        .update({
          clock_out: clockOut,
          break_minutes: payload.breakMinutes ?? 0,
          notes: payload.notes ?? existing?.notes ?? null,
          edited_by_user_id: ctx.user.id,
          edited_at: new Date().toISOString(),
        })
        .eq("company_id", ctx.company.id)
        .eq("id", entryId);

      if (error) return sendError(res, 500, "clock_out_failed", error.message);

      await recomputeWeeklyOvertime(ctx.admin, {
        companyId: ctx.company.id,
        userId: targetUserId,
        referenceDate: existing?.clock_in || clockOut,
        timeZone,
      });
      await logTimesheetActivity(ctx.admin, ctx, "Clocked out", {
        entry_id: entryId,
        subject_user_id: targetUserId,
        project_id: existing?.project_id || null,
      });
    }

    const refreshPayload = await loadTimeTrackingPayload(ctx, new Date(), targetUserId, timeZone);
    if (refreshPayload.error) return sendError(res, 500, refreshPayload.error);
    return sendOk(res, refreshPayload);
  }

  if (req.method === "PUT") {
    const parsed = UpdateEntrySchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    if (!canManageTimesheets(ctx, parsed.data.userId || ctx.user.id)) return sendError(res, 403, "forbidden");

    const { data: existing } = await ctx.admin
      .from("time_clock_entries")
      .select("id, user_id")
      .eq("company_id", ctx.company.id)
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (!existing?.id) return sendError(res, 404, "time_entry_not_found");
    if (!(await canManageTargetUser(ctx, existing.user_id))) return sendError(res, 403, "forbidden");

    const timeZone = normalizeTimeZone(parsed.data.timeZone);
    const { error } = await ctx.admin
      .from("time_clock_entries")
      .update({
        entry_date: formatDateInTimeZone(parsed.data.clockIn, timeZone),
        project_id: parsed.data.projectId || null,
        work_type: parsed.data.projectId ? "project" : "overhead",
        overhead_label: parsed.data.projectId ? null : parsed.data.overheadLabel || "Overhead",
        notes: parsed.data.notes || null,
        clock_in: parsed.data.clockIn,
        clock_out: parsed.data.clockOut || null,
        break_minutes: parsed.data.breakMinutes,
        is_manual: true,
        edited_by_user_id: ctx.user.id,
        edited_at: new Date().toISOString(),
      })
      .eq("company_id", ctx.company.id)
      .eq("id", parsed.data.id);

    if (error) return sendError(res, 500, "time_entry_update_failed", error.message);

    await recomputeWeeklyOvertime(ctx.admin, {
      companyId: ctx.company.id,
      userId: existing.user_id,
      referenceDate: parsed.data.clockIn,
      timeZone,
    });
    await logTimesheetActivity(ctx.admin, ctx, "Timesheet entry updated", {
      entry_id: parsed.data.id,
      subject_user_id: existing.user_id,
      project_id: parsed.data.projectId || null,
    });

    const refreshPayload = await loadTimeTrackingPayload(ctx, parsed.data.clockIn, existing.user_id, timeZone);
    if (refreshPayload.error) return sendError(res, 500, refreshPayload.error);
    return sendOk(res, refreshPayload);
  }

  if (req.method === "DELETE") {
    const parsed = DeleteEntrySchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    if (!canManageTimesheets(ctx, parsed.data.userId || ctx.user.id)) return sendError(res, 403, "forbidden");

    const { data: existing } = await ctx.admin
      .from("time_clock_entries")
      .select("id, user_id, project_id, clock_in")
      .eq("company_id", ctx.company.id)
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (!existing?.id) return sendError(res, 404, "time_entry_not_found");
    if (!(await canManageTargetUser(ctx, existing.user_id))) return sendError(res, 403, "forbidden");

    const timeZone = normalizeTimeZone(parsed.data.timeZone);
    const { error } = await ctx.admin
      .from("time_clock_entries")
      .delete()
      .eq("company_id", ctx.company.id)
      .eq("id", parsed.data.id);

    if (error) return sendError(res, 500, "time_entry_delete_failed", error.message);

    await recomputeWeeklyOvertime(ctx.admin, {
      companyId: ctx.company.id,
      userId: existing.user_id,
      referenceDate: existing.clock_in,
      timeZone,
    });
    await logTimesheetActivity(ctx.admin, ctx, "Timesheet entry deleted", {
      entry_id: parsed.data.id,
      subject_user_id: existing.user_id,
      project_id: existing.project_id || null,
    });

    const refreshPayload = await loadTimeTrackingPayload(ctx, existing.clock_in, existing.user_id, timeZone);
    if (refreshPayload.error) return sendError(res, 500, refreshPayload.error);
    return sendOk(res, refreshPayload);
  }

  return sendError(res, 405, "method_not_allowed");
}
