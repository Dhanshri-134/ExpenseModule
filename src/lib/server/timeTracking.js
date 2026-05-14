import { insertActivityLog } from "@/lib/server/taskWorkflow";

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeTimeZone(value) {
  const timeZone = String(value || "").trim();
  if (!timeZone) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function formatDateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

export function formatDateInTimeZone(value = new Date(), timeZone = "UTC") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const { year, month, day } = formatDateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCalendarDate(value, timeZone = "UTC") {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split("-").map(Number);
    return { year, month, day };
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatDateParts(new Date(), timeZone);
  }
  return formatDateParts(date, timeZone);
}

export function formatMinutes(totalMinutes) {
  const minutes = Math.max(Math.round(toNumber(totalMinutes)), 0);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

export function weekBoundsForDate(value, timeZone = "UTC") {
  const { year, month, day } = parseCalendarDate(value, timeZone);
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  const weekDay = baseDate.getUTCDay();
  const diff = weekDay === 0 ? -6 : 1 - weekDay;
  const start = new Date(baseDate);
  start.setUTCDate(start.getUTCDate() + diff);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export async function recomputeWeeklyOvertime(admin, { companyId, userId, referenceDate, timeZone = "UTC" }) {
  const bounds = weekBoundsForDate(referenceDate, timeZone);
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
