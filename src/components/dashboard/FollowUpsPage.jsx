"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Modal from "@/components/dashboard/Modal";
import { BusyButton, CompactListRow, DrilldownModal, StatusMetricButton } from "@/components/dashboard/DashboardUi";
import { useApiQuery } from "@/lib/client/apiQuery";
import { PhoneInput } from "@/shared/forms/PhoneInput";
import { Pencil, Plus, Trash2 } from "lucide-react";

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

function LabeledField({ label, children }) {
  return (
    <label className="relative block pt-3">
      <span className="acm-field-label">
        {label}
      </span>
      {children}
    </label>
  );
}

function FieldGroup({ title, children }) {
  return (
    <fieldset className="rounded-[20px] border border-[color:var(--acm-border)] p-4">
      <legend className="acm-fieldset-legend">{title}</legend>
      <div className="grid gap-3">{children}</div>
    </fieldset>
  );
}

function InlineMessage({ error, message }) {
  if (error) {
    return (
      <div className="acm-message-error">
        {error}
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]">
        {message}
      </div>
    );
  }

  return null;
}

export default function FollowUpsPage({ roleBase }) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("today");
  const [editingItem, setEditingItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const query = activeFilter === "all" ? "/api/followups" : `/api/followups?filter=${activeFilter}`;
const followUps = useApiQuery(query);
  const leads = useApiQuery("/api/leads");
    const [leadEditOpen, setLeadEditOpen] = useState(false);
   const [selectedLead, setSelectedLead] = useState(null);
    const [leadEditForm, setLeadEditForm] = useState({ name: "", address: "", contact: "", email: "" });
    const [leadEditBusy, setLeadEditBusy] = useState(false);
    const [followUpMessage, setFollowUpMessage] = useState("");
    const [followUpError, setFollowUpError] = useState("");
    const [followUpBusy, setFollowUpBusy] = useState(false);
    const [followUpFormOpen, setFollowUpFormOpen] = useState(false);
    const [editingFollowUpId, setEditingFollowUpId] = useState("");
    const [deletingFollowUpId, setDeletingFollowUpId] = useState("");
    const [followUpForm, setFollowUpForm] = useState({
      note: "",
      nextFollowUpDate: "",
      status: "pending",
    });
    // const followUps = useApiQuery(
    //   selectedLead ? `/api/lead-followups?leadId=${selectedLead.id}` : "",
    //   { enabled: Boolean(selectedLead) }
    // );
  
    function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
    const [form, setForm] = useState({
      name: "",
      address: "",
      contact: "",
      email: "",
      followUpDate: "",
      followUpNote: "",
      followUpStatus: "pending",
    });
  
    const leadList = leads.data?.leads ?? [];
  
    function openCreate() {
      setForm({
        name: "",
        address: "",
        contact: "",
        email: "",
        followUpDate: "",
        followUpNote: "",
        followUpStatus: "pending",
      });
      setOpen(true);
    }
  
    async function saveLead(e) {
      e.preventDefault();
      if (formBusy) return;
  
      setError("");
      setMessage("");
      setFormBusy(true);
  
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => null);
  
      if (!res.ok) {
        setError(json?.error || "lead_create_failed");
        setFormBusy(false);
        return;
      }
  
      setOpen(false);
      setMessage("Lead created");
      invalidateApiQuery("/api/leads");
      invalidateApiQuery("/api/dashboard");
      await leads.refresh();
      setFormBusy(false);
    }
  
    function openLeadEdit() {
      if (!selectedLead) return;
      setLeadEditForm({
        name: selectedLead.name || "",
        address: selectedLead.address || "",
        contact: selectedLead.contact || "",
        email: selectedLead.email || "",
      });
      setLeadEditOpen(true);
      setFollowUpFormOpen(false);
      setFollowUpMessage("");
      setFollowUpError("");
    }
  
    async function saveLeadEdit(e) {
      e.preventDefault();
      if (!selectedLead || leadEditBusy) return;
  
      setLeadEditBusy(true);
      setFollowUpMessage("");
      setFollowUpError("");
  
      const res = await fetch("/api/leads", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selectedLead.id, ...leadEditForm }),
      });
      const json = await res.json().catch(() => null);
  
      if (!res.ok) {
        setFollowUpError(json?.error || "lead_update_failed");
        setLeadEditBusy(false);
        return;
      }
  
      const updatedLead = { ...selectedLead, ...(json?.lead || leadEditForm) };
      setSelectedLead(updatedLead);
      setLeadEditOpen(false);
      setFollowUpMessage("Lead updated");
      invalidateApiQuery("/api/leads");
      await leads.refresh();
      setLeadEditBusy(false);
    }
  
    async function convertLead(lead) {
      if (lead.status === "converted" || convertBusyId) return;
      setError("");
      setMessage("");
      setConvertBusyId(lead.id);
  
      const res = await fetch("/api/lead", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: lead.id }),
      });
      const json = await res.json().catch(() => null);
  
      if (!res.ok) {
        setError(json?.error || "lead_convert_failed");
        setConvertBusyId("");
        return;
      }
  
      setMessage("Lead converted to client");
      invalidateApiQuery("/api/clients");
      invalidateApiQuery("/api/leads");
      await leads.refresh();
      setConvertBusyId("");
    }
  
    async function saveFollowUp(e) {
      e.preventDefault();
      if (!selectedLead || followUpBusy) return;
  
      setFollowUpMessage("");
      setFollowUpError("");
      setFollowUpBusy(true);
  
      const res = await fetch("/api/lead-followups", {
        method: editingFollowUpId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingFollowUpId || undefined,
          leadId: selectedLead.id,
          note: followUpForm.note,
          nextFollowUpDate: followUpForm.nextFollowUpDate,
          status: followUpForm.status,
        }),
      });
      const json = await res.json().catch(() => null);
  
      if (!res.ok) {
        setFollowUpError(json?.error || "lead_followup_create_failed");
        setFollowUpBusy(false);
        return;
      }
  
      setFollowUpForm({ note: "", nextFollowUpDate: "", status: "pending" });
      setEditingFollowUpId("");
      setFollowUpFormOpen(false);
      setFollowUpMessage(editingFollowUpId ? "Follow-up updated" : "Follow-up saved");
      invalidateApiQuery("/api/leads");
      await Promise.all([followUps.refresh(), leads.refresh()]);
      setFollowUpBusy(false);
    }
  
    function openFollowUpForm(item = null) {
      setLeadEditOpen(false);
      setFollowUpFormOpen(true);
      setEditingFollowUpId(item?.id || "");
      setFollowUpForm({
        note: item?.note || "",
        nextFollowUpDate: item?.next_follow_up_date || item?.date || "",
        status: item?.status || "pending",
      });
      setFollowUpMessage("");
      setFollowUpError("");
    }
  
    async function deleteLeadFollowUp(item) {
      if (!item || deletingFollowUpId) return;
      if (!window.confirm("Delete this follow-up?")) return;
  
      setDeletingFollowUpId(item.id);
      setFollowUpMessage("");
      setFollowUpError("");
  
      const res = await fetch("/api/lead-followups", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const json = await res.json().catch(() => null);
  
      if (!res.ok) {
        setFollowUpError(json?.error || "lead_followup_delete_failed");
        setDeletingFollowUpId("");
        return;
      }
  
      setFollowUpMessage("Follow-up deleted");
      invalidateApiQuery("/api/leads");
      await Promise.all([followUps.refresh(), leads.refresh()]);
      setDeletingFollowUpId("");
    }

  const leadById = useMemo(
    () => new Map((leads.data?.leads ?? []).map((lead) => [lead.id, lead])),
    [leads.data?.leads]
  );
  const grouped = useMemo(
    () =>
      (followUps.data?.followUps ?? []).map((item) => ({
        ...item,
        lead: item.ref_type === "lead" ? leadById.get(item.ref_id) ?? null : null,
      })),
    [followUps.data?.followUps, leadById]
  );

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
      <div className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 ">
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
            onClick={() => router.push(`/${roleBase}/leads`)}
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

      {followUps.error || leads.error || error ? (
        <div className="acm-message-error">{followUps.error || leads.error || error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {grouped.map((item) => (
          
                  <CompactListRow
  key={item.id}
  primary={item.lead?.name || item.refName || "-"}
  secondary={
    item.lead?.status === "converted"
      ? "Converted Lead"
      : "Enquiry Lead"
  }
  tertiary={
    <>
      {item.lead?.contact || "-"}
      <br />
      {item.lead?.email || "-"}
      <br />
      Next follow-up:{" "}
      {formatDate(
        item.lead?.nextFollowUpDate ||
        item.next_follow_up_date ||
        item.date
      )}
    </>
  }
  onClick={() => {
    if (!item.lead) return;

    setSelectedLead(item.lead);
    setLeadEditOpen(false);
    setFollowUpFormOpen(false);
    setEditingFollowUpId("");
    setFollowUpForm({
      note: "",
      nextFollowUpDate: "",
      status: "pending",
    });
    setFollowUpMessage("");
    setFollowUpError("");
  }}
/>
          // <div
          //   key={item.id}
          //   className="rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)]"
          // >
          //   <div className="flex items-start justify-between gap-3">
          //     <div>
          //       <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">
          //         {getRefLabel(item.ref_type)}
          //       </div>
          //       <div className="mt-2 text-lg font-bold text-[color:var(--acm-fg)]">
          //         {item.ref_type === "lead" ? item.refName : item.refName}
          //       </div>
          //       <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">{formatDate(item.date)}</div>
          //     </div>
          //     <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getStatusClass(item.status)}`}>
          //       {item.status ?? "-"}
          //     </span>
          //   </div>

          //   <div className="mt-4 text-sm text-[color:var(--acm-fg)]">{item.note ?? "-"}</div>

          //   <div className="mt-4 grid gap-2 text-sm text-[color:var(--acm-muted-fg)]">
          //     <div>Created By: {item.createdBy?.name ?? "-"}</div>
          //     <div>Email: {item.createdBy?.email ?? "-"}</div>
          //     <div>Created At: {formatDate(item.created_at)}</div>
          //   </div>

          //   {item.canModify ? (
          //     <div className="mt-4 flex gap-2">
          //       <button type="button" onClick={() => openEdit(item)} className="acm-btn acm-btn-secondary h-10 px-4">
          //         Edit
          //       </button>
          //       <button type="button" onClick={() => setDeleteItem(item)} className="acm-btn acm-btn-secondary h-10 px-4">
          //         Delete
          //       </button>
          //     </div>
          //   ) : null}
          // </div>
        ))}
      </div>

      {!followUps.loading && !grouped.length ? (
        <div className="rounded-[22px] border border-dashed border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-5 py-8 text-sm text-[color:var(--acm-muted-fg)]">
          No follow-ups found for this filter.
        </div>
      ) : null}


      <Modal
              open={Boolean(selectedLead)}
              title={selectedLead ? `${selectedLead.name} Follow Ups` : "Follow Ups"}
              onClose={() => {
                setSelectedLead(null);
                setLeadEditOpen(false);
                setFollowUpFormOpen(false);
                setEditingFollowUpId("");
                setFollowUpForm({ note: "", nextFollowUpDate: "", status: "pending" });
              }}
            >
              <div className="space-y-3">
      
                <InlineMessage error={followUps.error || followUpError} message={followUpMessage} />
      
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={openLeadEdit} className="acm-btn acm-btn-secondary h-10 px-4">
                    Edit Lead
                  </button>
                  <button type="button" onClick={() => openFollowUpForm()} className="acm-btn acm-btn-primary h-10 px-4">
                    <Plus size={16} />
                    Add Follow Up
                  </button>
                </div>
      
                {leadEditOpen ? (
                  <form onSubmit={saveLeadEdit} className="grid gap-3 rounded-[20px] border border-[color:var(--acm-border)] p-4">
                    <FieldGroup title="Edit Lead">
                      <LabeledField label="Client Name">
                        <input required className={fieldClass()} value={leadEditForm.name} onChange={(e) => setLeadEditForm((prev) => ({ ...prev, name: e.target.value }))} />
                      </LabeledField>
                      <LabeledField label="Client Contact">
                        <PhoneInput required className={fieldClass()} value={leadEditForm.contact} onValueChange={(value) => setLeadEditForm((prev) => ({ ...prev, contact: value }))} />
                      </LabeledField>
                      <LabeledField label="Client Email">
                        <input required type="email" className={fieldClass()} value={leadEditForm.email} onChange={(e) => setLeadEditForm((prev) => ({ ...prev, email: e.target.value }))} />
                      </LabeledField>
                      <LabeledField label="Client Address">
                        <textarea required className={fieldClass()} rows={3} value={leadEditForm.address} onChange={(e) => setLeadEditForm((prev) => ({ ...prev, address: e.target.value }))} />
                      </LabeledField>
                    </FieldGroup>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setLeadEditOpen(false)} className="acm-btn acm-btn-secondary h-10 px-4">Cancel</button>
                      <BusyButton type="submit" busy={leadEditBusy} className="acm-btn acm-btn-primary h-10 px-4">Save Lead</BusyButton>
                    </div>
                  </form>
                ) : null}
      
                {followUpFormOpen ? (
                  <form onSubmit={saveFollowUp} className="grid gap-3 rounded-[20px] border border-[color:var(--acm-border)] p-4">
                    <LabeledField label="Follow-up Note">
                      <textarea required className={fieldClass()} rows={3} value={followUpForm.note} onChange={(e) => setFollowUpForm((prev) => ({ ...prev, note: e.target.value }))} />
                    </LabeledField>
                    <LabeledField label="Next Follow-up Date">
                      <input type="date" className={fieldClass()} value={followUpForm.nextFollowUpDate} onChange={(e) => setFollowUpForm((prev) => ({ ...prev, nextFollowUpDate: e.target.value }))} />
                    </LabeledField>
                    <LabeledField label="Status">
                      <select className={fieldClass()} value={followUpForm.status} onChange={(e) => setFollowUpForm((prev) => ({ ...prev, status: e.target.value }))}>
                        <option value="pending">Pending</option>
                        <option value="done">Done</option>
                      </select>
                    </LabeledField>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFollowUpFormOpen(false);
                          setEditingFollowUpId("");
                          setFollowUpForm({ note: "", nextFollowUpDate: "", status: "pending" });
                        }}
                        className="acm-btn acm-btn-secondary h-10 px-4"
                      >
                        Cancel
                      </button>
                      <BusyButton type="submit" busy={followUpBusy} className="acm-btn acm-btn-primary h-10 px-4">
                        {editingFollowUpId ? "Save Follow Up" : "Add Follow Up"}
                      </BusyButton>
                    </div>
                  </form>
                ) : null}
      
                <div className="space-y-3">
                  {(followUps.data?.followUps ?? []).map((item) => (
                    <div key={item.id} className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">
                          {formatDateTime(item.created_at)}
                        </div>
                        {item.canModify !== false ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => openFollowUpForm(item)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--acm-border)] text-[color:var(--acm-muted-fg)] hover:text-[color:var(--acm-accent)]"
                              aria-label="Edit follow-up"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteLeadFollowUp(item)}
                              disabled={deletingFollowUpId === item.id}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--acm-border)] text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                              aria-label="Delete follow-up"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 text-sm text-[color:var(--acm-fg)]">{item.note}</div>
                      <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">
                        Follow-up Date: {formatDate(item.next_follow_up_date)} <br/> Status: {item.status ?? "-"}
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">
                        Created By: {item.createdBy?.name ?? "-"}
                      </div>
                    </div>
                  ))}
                  {!followUps.loading && !(followUps.data?.followUps ?? []).length ? (
                    <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-6 text-sm text-[color:var(--acm-muted-fg)]">
                      No follow-ups yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </Modal>

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
