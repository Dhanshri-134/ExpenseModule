"use client";

import { useState } from "react";
import Modal from "@/components/dashboard/Modal";
import { BusyButton } from "@/components/dashboard/DashboardUi";
import { sendJson } from "@/lib/client/apiClient";
import { useApiQuery } from "@/lib/client/apiQuery";

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
  const [weekOf, setWeekOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [clockForm, setClockForm] = useState({
    projectId: "",
    overheadLabel: "Overhead",
    notes: "",
    breakMinutes: "0",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [editingEntry, setEditingEntry] = useState(null);

  const query = useApiQuery(
    `/api/time-tracking?weekOf=${encodeURIComponent(weekOf)}${selectedUserId ? `&userId=${encodeURIComponent(selectedUserId)}` : ""}`
  );

  const canManage = Boolean(query.data?.canManage);
  const currentEntry = query.data?.currentEntry || null;
  const staff = query.data?.staff || [];
  const projects = query.data?.projects || [];
  const entries = query.data?.entries || [];
  const dailySummary = query.data?.dailySummary || [];
  const projectSummary = query.data?.projectSummary || [];
  const overheadSummary = query.data?.overheadSummary || [];
  const employeeTotals = query.data?.employeeTotals || [];
  const activeStaff = query.data?.activeStaff || [];
  const auditLogs = query.data?.auditLogs || [];
  const weeklySummary = query.data?.weeklySummary || { minutes: 0, overtimeMinutes: 0, todayMinutes: 0 };

  const selectedStaffName =
    staff.find((item) => item.user_id === (query.data?.selectedUserId || selectedUserId))?.name || "Selected staff";

  async function runAction(action, body, successMessage) {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      await sendJson("/api/time-tracking", { method: action === "edit" ? "PUT" : "POST", body });
      await query.refresh();
      setMessage(successMessage);
      if (action === "clock_in") {
        setClockForm((current) => ({ ...current, notes: "" }));
      }
      if (action === "edit") setEditingEntry(null);
    } catch (requestError) {
      setError(requestError.message || "time_tracking_action_failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <InlineMessage error={query.error || error} message={message} />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="Today" value={formatMinutes(weeklySummary.todayMinutes)} />
        <SummaryCard label="This Week" value={formatMinutes(weeklySummary.minutes)} />
        <SummaryCard label="Overtime" value={formatMinutes(weeklySummary.overtimeMinutes)} />
        <SummaryCard label="Active Staff" value={String(activeStaff.length)} />
        <SummaryCard label="Viewing" value={selectedStaffName} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-lg font-bold text-[color:var(--acm-fg)]">Check In / Out</div>
            <input type="date" className={fieldClass()} value={weekOf} onChange={(e) => setWeekOf(e.target.value)} />
          </div>

          {canManage ? (
            <label className="mb-4 block">
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Staff</div>
              <select className={fieldClass()} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                {staff.map((item) => (
                  <option key={item.user_id} value={item.user_id}>{item.name || item.user_name || item.user_code}</option>
                ))}
              </select>
            </label>
          ) : null}

          {!currentEntry ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Project</div>
                <select className={fieldClass()} value={clockForm.projectId} onChange={(e) => setClockForm((prev) => ({ ...prev, projectId: e.target.value }))}>
                  <option value="">Overhead / Non-project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>
              {!clockForm.projectId ? (
                <label>
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Overhead</div>
                  <input className={fieldClass()} value={clockForm.overheadLabel} onChange={(e) => setClockForm((prev) => ({ ...prev, overheadLabel: e.target.value }))} />
                </label>
              ) : null}
              <label className="md:col-span-2">
                <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Notes</div>
                <textarea className={fieldClass()} rows={3} value={clockForm.notes} onChange={(e) => setClockForm((prev) => ({ ...prev, notes: e.target.value }))} />
              </label>
              <BusyButton
                type="button"
                busy={busy === "clock_in"}
                className="acm-btn acm-btn-primary w-fit"
                onClick={() =>
                  runAction(
                    "clock_in",
                    {
                      action: "clock_in",
                      userId: selectedUserId,
                      projectId: clockForm.projectId || null,
                      overheadLabel: clockForm.projectId ? null : clockForm.overheadLabel,
                      notes: clockForm.notes,
                    },
                    "Clock in recorded."
                  )
                }
              >
                Clock In
              </BusyButton>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm">
                Active since {formatDateTime(currentEntry.clock_in)} for {currentEntry.project?.name || currentEntry.overhead_label || "Overhead"}.
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Break (minutes)</div>
                  <input className={fieldClass()} inputMode="numeric" value={clockForm.breakMinutes} onChange={(e) => setClockForm((prev) => ({ ...prev, breakMinutes: e.target.value }))} />
                </label>
                <label>
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Notes</div>
                  <input className={fieldClass()} value={clockForm.notes} onChange={(e) => setClockForm((prev) => ({ ...prev, notes: e.target.value }))} />
                </label>
              </div>
              <BusyButton
                type="button"
                busy={busy === "clock_out"}
                className="acm-btn acm-btn-primary w-fit"
                onClick={() =>
                  runAction(
                    "clock_out",
                    {
                      action: "clock_out",
                      id: currentEntry.id,
                      userId: selectedUserId,
                      breakMinutes: Number(clockForm.breakMinutes || 0),
                      notes: clockForm.notes,
                    },
                    "Clock out recorded."
                  )
                }
              >
                Clock Out
              </BusyButton>
            </div>
          )}
        </div>

        <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5">
          <div className="text-lg font-bold text-[color:var(--acm-fg)]">Real-time Active Staff</div>
          <div className="mt-4 space-y-3">
            {activeStaff.map((entry) => (
              <div key={entry.id} className="rounded-[16px] border border-[color:var(--acm-border)] px-4 py-3 text-sm">
                <div className="font-semibold">{entry.staff?.name || entry.staff?.user_code || "Staff"}</div>
                <div className="mt-1 text-[color:var(--acm-muted-fg)]">{entry.project?.name || entry.overhead_label || "Overhead"}</div>
                <div className="mt-1 text-[color:var(--acm-muted-fg)]">{formatDateTime(entry.clock_in)}</div>
              </div>
            ))}
            {!activeStaff.length ? <div className="text-sm text-[color:var(--acm-muted-fg)]">No active staff right now.</div> : null}
          </div>
        </div>
      </div>

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
                {canManage ? <button type="button" className="mt-3 text-sm font-semibold text-[color:var(--acm-accent)]" onClick={() => setEditingEntry(entry)}>Edit</button> : null}
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
              <input type="datetime-local" className={fieldClass()} value={(editingEntry.clock_in || "").slice(0, 16)} onChange={(e) => setEditingEntry((prev) => ({ ...prev, clock_in: new Date(e.target.value).toISOString() }))} />
            </label>
            <label>
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">Clock Out</div>
              <input type="datetime-local" className={fieldClass()} value={editingEntry.clock_out ? editingEntry.clock_out.slice(0, 16) : ""} onChange={(e) => setEditingEntry((prev) => ({ ...prev, clock_out: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
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
