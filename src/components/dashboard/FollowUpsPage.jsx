"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Modal from "@/components/dashboard/Modal";
import { BusyButton } from "@/components/dashboard/DashboardUi";
import { useApiQuery } from "@/lib/client/apiQuery";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value ?? "-";
  return date.toLocaleDateString();
}

function getStatusClass(status) {
  if (status === "done") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function getRefLabel(refType) {
  if (refType === "lead") return "Lead";
  if (refType === "client") return "Client";
  if (refType === "task") return "Task";
  return "Follow-up";
}

function fieldClass(error = false) {
  return `acm-input mt-0 ${error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" : ""}`.trim();
}

export default function FollowUpsPage({ roleBase }) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("today");
  const [editingItem, setEditingItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [form, setForm] = useState({ id: "", date: "", note: "", status: "pending" });
  const [formErrors, setFormErrors] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const query = activeFilter === "all" ? "/api/followups" : `/api/followups?filter=${activeFilter}`;
  const followUps = useApiQuery(query);

  const grouped = useMemo(() => followUps.data?.followUps ?? [], [followUps.data?.followUps]);

  function openEdit(item) {
    setEditingItem(item);
    setFormErrors({});
    setForm({
      id: item.id,
      date: item.date ?? "",
      note: item.note ?? "",
      status: item.status ?? "pending",
    });
  }

  function validateForm() {
    const nextErrors = {};
    if (!form.date) nextErrors.date = "Date is required.";
    if (!form.note.trim()) nextErrors.note = "Note is required.";
    return nextErrors;
  }

  async function refreshList() {
    await followUps.refresh();
  }

  async function saveFollowUp(event) {
    event.preventDefault();
    if (saveBusy) return;

    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      return;
    }

    setSaveBusy(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/followups", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: form.id,
        date: form.date,
        note: form.note.trim(),
        status: form.status,
      }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setError(json?.error || "followup_update_failed");
      setSaveBusy(false);
      return;
    }

    setMessage("Follow-up updated.");
    setEditingItem(null);
    setSaveBusy(false);
    await refreshList();
  }

  async function confirmDelete() {
    if (!deleteItem || deleteBusy) return;

    setDeleteBusy(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/followups", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: deleteItem.id }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setError(json?.error || "followup_delete_failed");
      setDeleteBusy(false);
      return;
    }

    setMessage("Follow-up deleted.");
    setDeleteBusy(false);
    setDeleteItem(null);
    await refreshList();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">
              Follow-up List
            </div>
            <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-[color:var(--acm-fg)]">
              Track pending and completed follow-ups
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/${roleBase}`)}
            className="acm-btn acm-btn-secondary h-10 px-4"
          >
            Back
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: "today", label: "Today" },
            { key: "upcoming", label: "Upcoming" },
            { key: "completed", label: "Completed" },
            { key: "all", label: "All" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveFilter(item.key)}
              className={`acm-btn ${activeFilter === item.key ? "acm-btn-primary" : "acm-btn-secondary"} h-10 px-4`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {followUps.error || error ? (
        <div className="acm-message-error">{followUps.error || error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {grouped.map((item) => (
          <div
            key={item.id}
            className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">
                  {getRefLabel(item.ref_type)}
                </div>
                <div className="mt-2 text-lg font-bold text-[color:var(--acm-fg)]">
                  {item.ref_type === "lead" ? item.refName : item.refName}
                </div>
                <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">{formatDate(item.date)}</div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getStatusClass(item.status)}`}>
                {item.status ?? "-"}
              </span>
            </div>

            <div className="mt-4 text-sm text-[color:var(--acm-fg)]">{item.note ?? "-"}</div>

            <div className="mt-4 grid gap-2 text-sm text-[color:var(--acm-muted-fg)]">
              <div>Created By: {item.createdBy?.name ?? "-"}</div>
              <div>Email: {item.createdBy?.email ?? "-"}</div>
              <div>Created At: {formatDate(item.created_at)}</div>
            </div>

            {item.canModify ? (
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => openEdit(item)} className="acm-btn acm-btn-secondary h-10 px-4">
                  Edit
                </button>
                <button type="button" onClick={() => setDeleteItem(item)} className="acm-btn acm-btn-secondary h-10 px-4">
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!followUps.loading && !grouped.length ? (
        <div className="rounded-[22px] border border-dashed border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-5 py-8 text-sm text-[color:var(--acm-muted-fg)]">
          No follow-ups found for this filter.
        </div>
      ) : null}

      <Modal open={Boolean(editingItem)} title="Edit Follow-up" onClose={() => setEditingItem(null)} maxWidth="max-w-xl">
        <form onSubmit={saveFollowUp} className="grid gap-4">
          <label className="grid gap-2">
            <span className="acm-field-label">Reference</span>
            <input className={fieldClass()} value={editingItem?.refName ?? "-"} readOnly />
          </label>
          <label className="grid gap-2">
            <span className="acm-field-label">Date</span>
            <input type="date" className={fieldClass(Boolean(formErrors.date))} value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            {formErrors.date ? <span className="text-sm text-rose-700">{formErrors.date}</span> : null}
          </label>
          <label className="grid gap-2">
            <span className="acm-field-label">Status</span>
            <select className={fieldClass()} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="pending">Pending</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="acm-field-label">Note</span>
            <textarea className={fieldClass(Boolean(formErrors.note))} rows={4} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
            {formErrors.note ? <span className="text-sm text-rose-700">{formErrors.note}</span> : null}
          </label>
          <div className="flex justify-end">
            <BusyButton type="submit" busy={saveBusy} className="acm-btn acm-btn-primary h-10 px-5">
              Save Changes
            </BusyButton>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteItem)} title="Delete Follow-up" onClose={() => setDeleteItem(null)} maxWidth="max-w-lg">
        <div className="space-y-5">
          <p className="text-sm text-[color:var(--acm-fg)]">
            Delete the follow-up for <span className="font-semibold">{deleteItem?.refName ?? "-"}</span>?
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setDeleteItem(null)} className="acm-btn acm-btn-secondary h-10 px-4">
              Cancel
            </button>
            <BusyButton type="button" busy={deleteBusy} onClick={confirmDelete} className="acm-btn acm-btn-primary h-10 px-4">
              Delete
            </BusyButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
