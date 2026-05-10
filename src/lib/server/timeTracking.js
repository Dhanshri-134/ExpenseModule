import { insertActivityLog } from "@/lib/server/taskWorkflow";

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function startOfWeekIso(value = new Date()) {
  const date = new Date(value);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function endOfWeekIso(value = new Date()) {
  const start = startOfWeekIso(value);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

export function formatMinutes(totalMinutes) {
  const minutes = Math.max(Math.round(toNumber(totalMinutes)), 0);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

export function weekBoundsForDate(value) {
  const start = startOfWeekIso(value);
  const end = endOfWeekIso(value);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export async function recomputeWeeklyOvertime(admin, { companyId, userId, referenceDate }) {
  const bounds = weekBoundsForDate(referenceDate);
  const { data: entries, error } = await admin
    .from("time_clock_entries")
    .select("id, clock_in, payable_minutes")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .gte("entry_date", bounds.startDate)
    .lte("entry_date", bounds.endDate)
    .order("clock_in", { ascending: true });

  if (error) throw new Error(error.message || "time_entries_fetch_failed");

  let runningMinutes = 0;
  for (const entry of entries ?? []) {
    const payableMinutes = Math.max(toNumber(entry.payable_minutes), 0);
    const remainingRegular = Math.max(2400 - runningMinutes, 0);
    const regularMinutes = Math.min(payableMinutes, remainingRegular);
    const overtimeMinutes = Math.max(payableMinutes - regularMinutes, 0);

    runningMinutes += payableMinutes;

    const { error: updateError } = await admin
      .from("time_clock_entries")
      .update({
        regular_minutes: regularMinutes,
        overtime_minutes: overtimeMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);

    if (updateError) throw new Error(updateError.message || "time_entry_overtime_update_failed");
  }
}

export function canManageTimesheets(ctx, targetUserId = null) {
  if (ctx.role === "owner") return true;
  if (ctx.role === "manager") {
    if (!targetUserId || targetUserId === ctx.user.id) return true;
    return ctx.projectAssignments.some((assignment) => assignment.role === "manager");
  }
  return !targetUserId || targetUserId === ctx.user.id;
}

export async function logTimesheetActivity(admin, ctx, message, metadata = {}) {
  await insertActivityLog(admin, {
    company_id: ctx.company.id,
    actor_user_id: ctx.user.id,
    project_id: metadata.project_id || null,
    message,
    metadata: {
      type: "timesheet",
      ...metadata,
    },
  });
}
