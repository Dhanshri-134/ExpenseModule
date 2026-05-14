"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/dashboard/Modal";
import { BusyButton } from "@/components/dashboard/DashboardUi";
import { sendJson } from "@/lib/client/apiClient";
import { useApiQuery } from "@/lib/client/apiQuery";
import { getBrowserTimeZone, getLocalDateInputValue, localDateTimeInputToIso, toLocalDateTimeInputValue } from "@/shared/utils/dateTime";

function fieldClass() {
  return "acm-input mt-0";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatMinutes(value) {
  const total = Math.max(Number(value || 0), 0);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function InlineMessage({ error, message }) {
  if (!error && !message) return null;
  return <div className={error ? "acm-message-error" : "rounded-xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm"}>{error || message}</div>;
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-[20px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">{label}</div>
      <div className="mt-2 text-xl font-bold text-[color:var(--acm-fg)]">{value}</div>
    </div>
  );
}

export default function TimeTrackingPage({ roleBase = "employee", currentUserId = "" }) {
  const [weekOf, setWeekOf] = useState(() => getLocalDateInputValue());
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const timeZone = getBrowserTimeZone();
  const [clockForm, setClockForm] = useState({
    projectId: "",
    notes: "",
    breakMinutes: "0",
    clockIn: toLocalDateTimeInputValue(new Date()),
    clockOut: toLocalDateTimeInputValue(new Date()),
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [editingEntry, setEditingEntry] = useState(null);

  const query = useApiQuery(
    `/api/time-tracking?weekOf=${encodeURIComponent(weekOf)}${selectedUserId ? `&userId=${encodeURIComponent(selectedUserId)}` : ""}&timeZone=${encodeURIComponent(timeZone)}`
  );
  const isOwnerView = roleBase === "owner";

  const canManage = Boolean(query.data?.canManage);
  const currentEntry = query.data?.currentEntry || null;
  const staff = query.data?.staff || [];
  const staffOptions = staff.filter((item) => item.role !== "owner");
  const projects = query.data?.projects || [];
  const entries = query.data?.entries || [];
  const dailySummary = query.data?.dailySummary || [];
  const projectSummary = query.data?.projectSummary || [];
  const overheadSummary = query.data?.overheadSummary || [];
  const employeeTotals = query.data?.employeeTotals || [];
  const activeStaff = query.data?.activeStaff || [];
  const auditLogs = query.data?.auditLogs || [];
  const weeklySummary = query.data?.weeklySummary || { minutes: 0, overtimeMinutes: 0, todayMinutes: 0 };
  const selectedStaffId = query.data?.selectedUserId || selectedUserId;

  const selectedStaffName =
    staffOptions.find((item) => item.user_id === selectedStaffId)?.name || "Selected staff";

  useEffect(() => {
    if (!canManage || !staffOptions.length) return;
    if (!selectedUserId || !staffOptions.some((item) => item.user_id === selectedUserId)) {
      setSelectedUserId(staffOptions[0].user_id);
    }
  }, [canManage, selectedUserId, staffOptions]);

  useEffect(() => {
    if (!currentEntry) {
        setClockForm((current) => ({
          ...current,
          clockOut: toLocalDateTimeInputValue(new Date()),
        }));
      return;
    }

    setClockForm((current) => ({
      ...current,
      clockOut: toLocalDateTimeInputValue(currentEntry.clock_out || new Date()),
    }));
  }, [currentEntry]);

  async function runAction(action, body, successMessage) {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      await sendJson("/api/time-tracking", { method: action === "edit" ? "PUT" : "POST", body });
      await query.refresh();
      setMessage(successMessage);
      if (action === "clock_in") {
        setClockForm((current) => ({
          ...current,
          notes: "",
          breakMinutes: "0",
          clockIn: toLocalDateTimeInputValue(new Date()),
          clockOut: toLocalDateTimeInputValue(new Date()),
        }));
      }
      if (action === "edit") setEditingEntry(null);
    } catch (requestError) {
      setError(requestError.message || "time_tracking_action_failed");
    } finally {
      setBusy("");
    }
  }

  async function deleteEntry(entry) {
    if (!entry?.id) return;
    if (!window.confirm("Delete this timesheet entry?")) return;

    setBusy(`delete:${entry.id}`);
    setError("");
    setMessage("");
    try {
      await sendJson("/api/time-tracking", {
        method: "DELETE",
        body: {
          id: entry.id,
          userId: entry.user_id,
          timeZone,
        },
      });
      await query.refresh();
      setMessage("Timesheet entry deleted.");
      if (editingEntry?.id === entry.id) setEditingEntry(null);
    } catch (requestError) {
      setError(requestError.message || "time_tracking_delete_failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <InlineMessage error={query.error || error} message={message} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[color:var(--acm-muted-fg)]">Week of {weekOf}</div>
        <input type="date" className={fieldClass()} value={weekOf} onChange={(e) => setWeekOf(e.target.value)} />
      </div>

      {isOwnerView && canManage ? (
        <label className="block">
          <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Staff</div>
          <select className={fieldClass()} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            {staffOptions.map((item) => (
              <option key={item.user_id} value={item.user_id}>{item.name || item.user_name || item.user_code}</option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="Today" value={formatMinutes(weeklySummary.todayMinutes)} />
        <SummaryCard label="This Week" value={formatMinutes(weeklySummary.minutes)} />
        <SummaryCard label="Overtime" value={formatMinutes(weeklySummary.overtimeMinutes)} />
        <SummaryCard label="Active Staff" value={String(activeStaff.length)} />
        <SummaryCard label="Viewing" value={selectedStaffName} />
      </div>

      {isOwnerView ? null : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-bold text-[color:var(--acm-fg)]">Clock In</div>
            </div>

            {canManage ? (
              <label className="mb-4 block">
                <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Staff</div>
                <select className={fieldClass()} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                  {staffOptions.map((item) => (
                    <option key={item.user_id} value={item.user_id}>{item.name || item.user_name || item.user_code}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="space-y-4">
              {currentEntry ? (
                <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm">
                  Active since {formatDateTime(currentEntry.clock_in)} for {currentEntry.project?.name || currentEntry.overhead_label || "Overhead"}.
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-3 text-sm text-[color:var(--acm-muted-fg)]">
                  No active clock-in for this staff member.
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Project</div>
                  <select
                    className={fieldClass()}
                    value={clockForm.projectId}
                    disabled={Boolean(currentEntry)}
                    onChange={(e) => setClockForm((prev) => ({ ...prev, projectId: e.target.value }))}
                  >
                    <option value="">Overhead</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Time</div>
                  <input
                    type="datetime-local"
                    className={fieldClass()}
                    disabled={Boolean(currentEntry)}
                    value={clockForm.clockIn}
                    onChange={(e) => setClockForm((prev) => ({ ...prev, clockIn: e.target.value }))}
                  />
                </label>
                <label className="md:col-span-2">
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Notes</div>
                  <textarea
                    className={fieldClass()}
                    rows={3}
                    disabled={Boolean(currentEntry)}
                    value={clockForm.notes}
                    onChange={(e) => setClockForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </label>
                <BusyButton
                  type="button"
                  busy={busy === "clock_in"}
                  className="acm-btn acm-btn-primary w-fit"
                  disabled={Boolean(currentEntry)}
                  onClick={() =>
                    runAction(
                      "clock_in",
                      {
                        action: "clock_in",
                        userId: selectedUserId,
                        projectId: clockForm.projectId || null,
                        overheadLabel: clockForm.projectId ? null : "Overhead",
                        notes: clockForm.notes,
                        clockIn: localDateTimeInputToIso(clockForm.clockIn) || new Date().toISOString(),
                        timeZone,
                      },
                      "Clock in recorded."
                    )
                  }
                >
                  Clock In
                </BusyButton>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-lg font-bold text-[color:var(--acm-fg)]">Clock Out</div>
              {currentEntry ? (
                <div className="text-sm text-[color:var(--acm-muted-fg)]">
                  Started {formatDateTime(currentEntry.clock_in)}
                </div>
              ) : null}
            </div>
            <div className="space-y-4">
              {currentEntry ? (
                <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm">
                  Closing shift for {currentEntry.project?.name || currentEntry.overhead_label || "Overhead"}.
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-3 text-sm text-[color:var(--acm-muted-fg)]">
                  Clock out becomes available after a staff member has clocked in.
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Time</div>
                  <input
                    type="datetime-local"
                    className={fieldClass()}
                    disabled={!currentEntry}
                    value={clockForm.clockOut}
                    onChange={(e) => setClockForm((prev) => ({ ...prev, clockOut: e.target.value }))}
                  />
                </label>
                <label>
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Break (minutes)</div>
                  <input
                    className={fieldClass()}
                    inputMode="numeric"
                    disabled={!currentEntry}
                    value={clockForm.breakMinutes}
                    onChange={(e) => setClockForm((prev) => ({ ...prev, breakMinutes: e.target.value }))}
                  />
                </label>
                <label className="md:col-span-2">
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Notes</div>
                  <textarea
                    className={fieldClass()}
                    rows={3}
                    disabled={!currentEntry}
                    value={clockForm.notes}
                    onChange={(e) => setClockForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </label>
                <BusyButton
                  type="button"
                  busy={busy === "clock_out"}
                  className="acm-btn acm-btn-primary w-fit"
                  disabled={!currentEntry}
                  onClick={() =>
                    runAction(
                      "clock_out",
                      {
                        action: "clock_out",
                        id: currentEntry.id,
                        userId: selectedUserId,
                        breakMinutes: Number(clockForm.breakMinutes || 0),
                        notes: clockForm.notes,
                        clockOut: localDateTimeInputToIso(clockForm.clockOut) || new Date().toISOString(),
                        timeZone,
                      },
                      "Clock out recorded."
                    )
                  }
                >
                  Clock Out
                </BusyButton>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
          <div className="text-lg font-bold text-[color:var(--acm-fg)]">Daily Timesheet</div>
          <div className="mt-4 space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-[16px] border border-[color:var(--acm-border)] px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold">{entry.project?.name || entry.overhead_label || "Overhead"}</div>
                  <div>{formatMinutes(entry.payable_minutes)}</div>
                </div>
                <div className="mt-1 text-[color:var(--acm-muted-fg)]">{formatDateTime(entry.clock_in)} to {formatDateTime(entry.clock_out)}</div>
                <div className="mt-1 text-[color:var(--acm-muted-fg)]">Break: {entry.break_minutes || 0} min | OT: {formatMinutes(entry.overtime_minutes)}</div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {canManage ? (
                    <button type="button" className="text-sm font-semibold text-[color:var(--acm-accent)]" onClick={() => setEditingEntry(entry)}>
                      Edit
                    </button>
                  ) : null}
                  <BusyButton
                    type="button"
                    busy={busy === `delete:${entry.id}`}
                    className="text-sm font-semibold text-rose-600"
                    onClick={() => deleteEntry(entry)}
                  >
                    Delete
                  </BusyButton>
                </div>
              </div>
            ))}
            {!entries.length ? <div className="text-sm text-[color:var(--acm-muted-fg)]">No entries for this week yet.</div> : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
            <div className="text-lg font-bold text-[color:var(--acm-fg)]">Weekly Summary</div>
            <div className="mt-4 space-y-2 text-sm">
              {dailySummary.map((item) => (
                <div key={item.date} className="flex items-center justify-between">
                  <span>{item.date}</span>
                  <span>{formatMinutes(item.minutes)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
            <div className="text-lg font-bold text-[color:var(--acm-fg)]">Project Labor Summary</div>
            <div className="mt-4 space-y-2 text-sm">
              {projectSummary.map((item) => (
                <div key={item.project_id} className="flex items-center justify-between">
                  <span>{item.project_name}</span>
                  <span>{formatMinutes(item.minutes)}</span>
                </div>
              ))}
              {!projectSummary.length ? <div className="text-[color:var(--acm-muted-fg)]">No project hours this week.</div> : null}
            </div>
          </div>

          <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
            <div className="text-lg font-bold text-[color:var(--acm-fg)]">Overhead Tracking</div>
            <div className="mt-4 space-y-2 text-sm">
              {overheadSummary.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span>{item.label}</span>
                  <span>{formatMinutes(item.minutes)}</span>
                </div>
              ))}
              {!overheadSummary.length ? <div className="text-[color:var(--acm-muted-fg)]">No overhead hours this week.</div> : null}
            </div>
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
            <div className="text-lg font-bold text-[color:var(--acm-fg)]">Employee Totals</div>
            <div className="mt-4 space-y-2 text-sm">
              {employeeTotals.map((item) => (
                <div key={item.user_id} className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <span>{formatMinutes(item.minutes)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
            <div className="text-lg font-bold text-[color:var(--acm-fg)]">Audit Log</div>
            <div className="mt-4 space-y-3 text-sm">
              {auditLogs.map((item) => (
                <div key={item.id} className="rounded-[16px] border border-[color:var(--acm-border)] px-4 py-3">
                  <div className="font-semibold">{item.message}</div>
                  <div className="mt-1 text-[color:var(--acm-muted-fg)]">{item.actor?.name || item.actor?.user_code || "System"} | {formatDateTime(item.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <Modal open={Boolean(editingEntry)} title="Edit Timesheet Entry" onClose={() => setEditingEntry(null)}>
        {editingEntry ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              runAction(
                "edit",
                {
                  id: editingEntry.id,
                  projectId: editingEntry.project_id || null,
                  overheadLabel: editingEntry.project_id ? null : editingEntry.overhead_label || "Overhead",
                  notes: editingEntry.notes || "",
                  clockIn: editingEntry.clock_in,
                  clockOut: editingEntry.clock_out,
                  breakMinutes: Number(editingEntry.break_minutes || 0),
                  timeZone,
                },
                "Timesheet updated."
              );
            }}
          >
            <label>
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Project</div>
              <select className={fieldClass()} value={editingEntry.project_id || ""} onChange={(e) => setEditingEntry((prev) => ({ ...prev, project_id: e.target.value || null }))}>
                <option value="">Overhead</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </label>
            {!editingEntry.project_id ? (
              <label>
                <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Overhead</div>
                <input className={fieldClass()} value={editingEntry.overhead_label || ""} onChange={(e) => setEditingEntry((prev) => ({ ...prev, overhead_label: e.target.value }))} />
              </label>
            ) : null}
            <label>
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Clock In</div>
              <input type="datetime-local" className={fieldClass()} value={toLocalDateTimeInputValue(editingEntry.clock_in)} onChange={(e) => setEditingEntry((prev) => ({ ...prev, clock_in: localDateTimeInputToIso(e.target.value) || prev.clock_in }))} />
            </label>
            <label>
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Clock Out</div>
              <input type="datetime-local" className={fieldClass()} value={toLocalDateTimeInputValue(editingEntry.clock_out)} onChange={(e) => setEditingEntry((prev) => ({ ...prev, clock_out: e.target.value ? localDateTimeInputToIso(e.target.value) : null }))} />
            </label>
            <label>
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Break (minutes)</div>
              <input className={fieldClass()} inputMode="numeric" value={editingEntry.break_minutes || 0} onChange={(e) => setEditingEntry((prev) => ({ ...prev, break_minutes: e.target.value }))} />
            </label>
            <label>
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Notes</div>
              <textarea className={fieldClass()} rows={3} value={editingEntry.notes || ""} onChange={(e) => setEditingEntry((prev) => ({ ...prev, notes: e.target.value }))} />
            </label>
            <BusyButton type="submit" busy={busy === "edit"} className="acm-btn acm-btn-primary">Save</BusyButton>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
