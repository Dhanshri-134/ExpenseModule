"use client";

import { useState } from "react";
import Modal from "@/components/dashboard/Modal";
import { BusyButton, CompactListRow } from "@/components/dashboard/DashboardUi";
import { invalidateApiQuery, useApiQuery } from "@/lib/client/apiQuery";
import { ProjectEstimatesWorkspace } from "@/components/dashboard/Project/ProjectEstimateTemplate";

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function fieldClass() {
  return "acm-input mt-0";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function LabeledField({ label, children }) {
  return (
    <label className="relative block pt-3">
      <span className="absolute left-3 top-0 z-10 bg-[color:var(--acm-surface)] px-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function FieldGroup({ title, children }) {
  return (
    <fieldset className="rounded-[20px] border border-[color:var(--acm-border)] p-4">
      <legend className="px-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">{title}</legend>
      <div className="grid gap-3">{children}</div>
    </fieldset>
  );
}

function InlineMessage({ error, message }) {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-500">
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

function formatApiError(json, fallback) {
  if (json?.detail?.fieldErrors) {
    const fieldMessages = Object.values(json.detail.fieldErrors)
      .flat()
      .filter(Boolean);
    if (fieldMessages.length) return fieldMessages[0];
  }

  if (typeof json?.detail === "string" && json.detail.trim()) return json.detail;
  if (typeof json?.error === "string" && json.error.trim()) return json.error;
  return fallback;
}

function SectionHeader({ title, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="text-xl font-bold text-[color:var(--acm-fg)]">{title}</div>
      {action}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2 text-sm last:border-b-0">
      <div className="font-semibold text-[color:var(--acm-muted-fg)]">{label}</div>
      <div className="text-[color:var(--acm-fg)]">{value || "-"}</div>
    </div>
  );
}

function createFieldReportForm(projectId) {
  return {
    id: "",
    projectId,
    reportDate: new Date().toISOString().slice(0, 10),
    reportTime: "08:00",
    location: "",
    weatherConditions: "",
    temperatureValue: "",
    temperatureUnit: "F",
    weatherImpact: "",
    publicCommunications: [{ name: "", phoneNumber: "", comments: "" }],
    contractorLaborForce: [{ classification: "", personnel: "" }],
    subcontractorsOnsite: [{ companyName: "", supervisor: "", totalPersons: "" }],
    equipmentUsed: [{ equipmentType: "", makeModel: "", typeOfWork: "", timeInUse: "" }],
    materialsUsed: [{ type: "", amountUsed: "", amountRemaining: "" }],
    workActivities: [""],
    coordinationLogs: [""],
    comments: "",
    sitePictures: [],
    signoffName: "",
    signoffRole: "Manager",
  };
}

function createStructuredRow(template) {
  return { ...template };
}

async function readFilesAsDataUrls(files) {
  const jobs = Array.from(files ?? []).map(
    (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("image_read_failed"));
        reader.readAsDataURL(file);
      })
  );

  return Promise.all(jobs);
}

export function ProjectEstimatesPage({ projectId, canManage = false }) {
  return <ProjectEstimatesWorkspace projectId={projectId} canManage={canManage} />;
}

export function ProjectFieldReportsPage({ projectId, roleBase = "employee", currentUserId = "" }) {
  const reportsQuery = useApiQuery(projectId ? `/api/field-reports?projectId=${projectId}` : null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [form, setForm] = useState(() => createFieldReportForm(projectId));

  const reports = reportsQuery.data?.reports ?? [];
  const canManageReports = roleBase === "manager" || roleBase === "owner";
  const useDetailedInspectionForm = canManageReports;
  const canCreateReports = Boolean(projectId);

  function canEdit(report) {
    if (!report) return false;
    if (canManageReports) return true;
    return report.created_by_user_id === currentUserId;
  }

  function openCreate() {
    setForm(createFieldReportForm(projectId));
    setError("");
    setMessage("");
    setOpen(true);
  }

  function openEdit(report) {
    setForm({
      id: report.id,
      projectId,
      reportDate: report.report_date || new Date().toISOString().slice(0, 10),
      reportTime: report.report_time || "",
      location: report.location || "",
      weatherConditions: report.weather_conditions || "",
      temperatureValue: report.temperature_value ?? "",
      temperatureUnit: report.temperature_unit || "F",
      weatherImpact: report.weather_impact || "",
      publicCommunications: (report.public_communications ?? []).length
        ? (report.public_communications ?? []).map((entry) => ({
            name: entry.name || "",
            phoneNumber: entry.phoneNumber || "",
            comments: entry.comments || "",
          }))
        : [{ name: "", phoneNumber: "", comments: "" }],
      contractorLaborForce: (report.contractor_labor_force ?? []).length
        ? (report.contractor_labor_force ?? []).map((entry) => ({
            classification: entry.classification || "",
            personnel: entry.personnel || "",
          }))
        : [{ classification: "", personnel: "" }],
      subcontractorsOnsite: (report.subcontractors_onsite ?? []).length
        ? (report.subcontractors_onsite ?? []).map((entry) => ({
            companyName: entry.companyName || "",
            supervisor: entry.supervisor || "",
            totalPersons: entry.totalPersons || "",
          }))
        : [{ companyName: "", supervisor: "", totalPersons: "" }],
      equipmentUsed: (report.equipment_used ?? []).length
        ? (report.equipment_used ?? []).map((entry) => ({
            equipmentType: entry.equipmentType || "",
            makeModel: entry.makeModel || "",
            typeOfWork: entry.typeOfWork || "",
            timeInUse: entry.timeInUse || "",
          }))
        : [{ equipmentType: "", makeModel: "", typeOfWork: "", timeInUse: "" }],
      materialsUsed: (report.materials_used ?? []).length
        ? (report.materials_used ?? []).map((entry) => ({
            type: entry.type || "",
            amountUsed: entry.amountUsed || "",
            amountRemaining: entry.amountRemaining || "",
          }))
        : [{ type: "", amountUsed: "", amountRemaining: "" }],
      workActivities: (report.work_activities ?? []).map((entry) => entry.text || "").concat((report.work_activities ?? []).length ? [] : [""]),
      coordinationLogs: (report.coordination_logs ?? []).map((entry) => entry.text || "").concat((report.coordination_logs ?? []).length ? [] : [""]),
      comments: report.comments || "",
      sitePictures: report.site_pictures ?? [],
      signoffName: report.signoff_name || "",
      signoffRole: report.signoff_role || "",
    });
    setSelectedReport(null);
    setError("");
    setMessage("");
    setOpen(true);
  }

  function updateListValue(key, index, value) {
    setForm((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  }

  function addListValue(key) {
    setForm((current) => ({
      ...current,
      [key]: [...current[key], ""],
    }));
  }

  function removeListValue(key, index) {
    setForm((current) => ({
      ...current,
      [key]: current[key].length > 1 ? current[key].filter((_, itemIndex) => itemIndex !== index) : current[key],
    }));
  }

  function updateStructuredValue(key, index, field, value) {
    setForm((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  }

  function addStructuredValue(key, template) {
    setForm((current) => ({
      ...current,
      [key]: [...current[key], createStructuredRow(template)],
    }));
  }

  function removeStructuredValue(key, index) {
    setForm((current) => ({
      ...current,
      [key]: current[key].length > 1 ? current[key].filter((_, itemIndex) => itemIndex !== index) : current[key],
    }));
  }

  async function onPicturesChange(event) {
    const files = event.target.files;
    if (!files?.length) return;
    try {
      const images = await readFilesAsDataUrls(files);
      setForm((current) => ({
        ...current,
        sitePictures: [...current.sitePictures, ...images],
      }));
    } catch (pictureError) {
      setError(pictureError.message || "image_upload_failed");
    }
  }

  async function saveReport(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");

    const method = form.id ? "PUT" : "POST";
    const res = await fetch("/api/field-reports", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setError(formatApiError(json, "field_report_save_failed"));
      setBusy(false);
      return;
    }

    setMessage(form.id ? "Field report updated." : "Field report created.");
    setOpen(false);
    invalidateApiQuery(`/api/field-reports?projectId=${projectId}`);
    await reportsQuery.refresh();
    setBusy(false);
  }

  async function deleteReport(report) {
    if (!window.confirm(`Delete field report for ${formatDate(report.report_date)}?`)) return;
    setError("");
    setMessage("");
    const res = await fetch("/api/field-reports", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: report.id, projectId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(formatApiError(json, "field_report_delete_failed"));
      return;
    }
    setMessage("Field report deleted.");
    if (selectedReport?.id === report.id) setSelectedReport(null);
    invalidateApiQuery(`/api/field-reports?projectId=${projectId}`);
    await reportsQuery.refresh();
  }

  return (
    <>
      <SectionHeader
        title="Field Operations And Daily Inspection Reports"
        action={
          canCreateReports ? (
            <button type="button" onClick={openCreate} className="acm-btn acm-btn-primary h-10 px-4">
              New Report
            </button>
          ) : null
        }
      />

      <InlineMessage error={reportsQuery.error || error} message={message} />

      <div className={cardClass()}>
        <div className="mb-4">
          <div className="text-lg font-bold text-[color:var(--acm-fg)]">Daily Inspection Archive</div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {!reports.length ? (
            <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-6 text-sm text-[color:var(--acm-muted-fg)] lg:col-span-2">
              No field reports recorded for this project yet.
            </div>
          ) : null}

          {reports.map((report) => (
            <div key={report.id} className="rounded-[20px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-4">
              <CompactListRow
              key={report.id}
              primary={`${formatDate(report.report_date)} | ${report.location || "Site report"}`}
              secondary={`${report.report_time || "Time pending"} | ${report.weather_conditions || "Weather pending"} | ${report.temperature_range || "Temp pending"}`}
              tertiary={`Created by ${report.created_by?.name || report.created_by?.user_name || report.created_by?.user_code || "-"} | ${report.work_activities?.length || 0} work logs | ${(report.equipment_used ?? []).length || 0} equipment entries`}
              onClick={() => setSelectedReport(report)}
              actions={
                canEdit(report) ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(report);
                      }}
                      className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteReport(report);
                      }}
                      className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                ) : null
              }
            />
            </div>
          ))}
        </div>
      </div>

      <Modal open={open} title={form.id ? "Edit Field Report" : "Create Field Report"} onClose={() => setOpen(false)}>
        <form onSubmit={saveReport} className="grid gap-4">
          <FieldGroup title="Report Details">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <LabeledField label="Project Date">
                <input type="date" className={fieldClass()} value={form.reportDate} onChange={(event) => setForm((current) => ({ ...current, reportDate: event.target.value }))} />
              </LabeledField>
              <LabeledField label="Time">
                <input type="time" className={fieldClass()} value={form.reportTime} onChange={(event) => setForm((current) => ({ ...current, reportTime: event.target.value }))} />
              </LabeledField>
              <LabeledField label="Location">
                <input className={fieldClass()} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
              </LabeledField>
              <LabeledField label="Weather Conditions">
                <input className={fieldClass()} value={form.weatherConditions} onChange={(event) => setForm((current) => ({ ...current, weatherConditions: event.target.value }))} />
              </LabeledField>
              {useDetailedInspectionForm ? (
                <>
                  <LabeledField label="Temperature Value">
                    <input type="number" min="-50" max="150" step="0.1" className={fieldClass()} value={form.temperatureValue} onChange={(event) => setForm((current) => ({ ...current, temperatureValue: event.target.value }))} />
                  </LabeledField>
                  <LabeledField label="Temperature Unit">
                    <select className={fieldClass()} value={form.temperatureUnit} onChange={(event) => setForm((current) => ({ ...current, temperatureUnit: event.target.value }))}>
                      <option value="F">Degree F</option>
                      <option value="C">Degree C</option>
                    </select>
                  </LabeledField>
                </>
              ) : (
                <LabeledField label="Temperature Range">
                  <input className={fieldClass()} value={form.temperatureValue ? `${form.temperatureValue} °${form.temperatureUnit}` : ""} onChange={(event) => setForm((current) => ({ ...current, temperatureValue: event.target.value, temperatureUnit: "F" }))} />
                </LabeledField>
              )}
              <LabeledField label="Weather Impact">
                <input className={fieldClass()} value={form.weatherImpact} onChange={(event) => setForm((current) => ({ ...current, weatherImpact: event.target.value }))} />
              </LabeledField>
            </div>
          </FieldGroup>

          {useDetailedInspectionForm ? (
            <>
          <FieldGroup title="Communications With Public">
            <div className="space-y-3">
              {form.publicCommunications.map((entry, index) => (
                <div key={`public-${index}`} className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Communication Entry {index + 1}</div>
                    {form.publicCommunications.length > 1 ? (
                      <button type="button" onClick={() => removeStructuredValue("publicCommunications", index)} className="text-xs font-semibold text-rose-500">
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <LabeledField label="Name">
                      <input className={fieldClass()} value={entry.name} onChange={(event) => updateStructuredValue("publicCommunications", index, "name", event.target.value)} />
                    </LabeledField>
                    <LabeledField label="Phone Number">
                      <input className={fieldClass()} value={entry.phoneNumber} onChange={(event) => updateStructuredValue("publicCommunications", index, "phoneNumber", event.target.value)} />
                    </LabeledField>
                    <LabeledField label="Comments">
                      <input className={fieldClass()} value={entry.comments} onChange={(event) => updateStructuredValue("publicCommunications", index, "comments", event.target.value)} />
                    </LabeledField>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addStructuredValue("publicCommunications", { name: "", phoneNumber: "", comments: "" })} className="acm-btn acm-btn-secondary h-10 px-4">
              Add Communication
            </button>
          </FieldGroup>

          <FieldGroup title="Contractor Labor Force">
            <div className="space-y-3">
              {form.contractorLaborForce.map((entry, index) => (
                <div key={`labor-${index}`} className="grid gap-3 rounded-[18px] border border-[color:var(--acm-border)] p-4 md:grid-cols-[1fr_1.6fr_auto] md:items-start">
                  <LabeledField label="Classification">
                    <input className={fieldClass()} value={entry.classification} onChange={(event) => updateStructuredValue("contractorLaborForce", index, "classification", event.target.value)} />
                  </LabeledField>
                  <LabeledField label="First And Last Names">
                    <input className={fieldClass()} value={entry.personnel} onChange={(event) => updateStructuredValue("contractorLaborForce", index, "personnel", event.target.value)} />
                  </LabeledField>
                  <div className="pt-3">
                    {form.contractorLaborForce.length > 1 ? (
                      <button type="button" onClick={() => removeStructuredValue("contractorLaborForce", index)} className="mt-2 text-xs font-semibold text-rose-500">
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addStructuredValue("contractorLaborForce", { classification: "", personnel: "" })} className="acm-btn acm-btn-secondary h-10 px-4">
              Add Labor Line
            </button>
          </FieldGroup>

          <FieldGroup title="Subcontractors Onsite">
            <div className="space-y-3">
              {form.subcontractorsOnsite.map((entry, index) => (
                <div key={`subcontractor-${index}`} className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <LabeledField label="Company Name">
                      <input className={fieldClass()} value={entry.companyName} onChange={(event) => updateStructuredValue("subcontractorsOnsite", index, "companyName", event.target.value)} />
                    </LabeledField>
                    <LabeledField label="Supervisor">
                      <input className={fieldClass()} value={entry.supervisor} onChange={(event) => updateStructuredValue("subcontractorsOnsite", index, "supervisor", event.target.value)} />
                    </LabeledField>
                    <LabeledField label="Total # Of Persons">
                      <input className={fieldClass()} value={entry.totalPersons} onChange={(event) => updateStructuredValue("subcontractorsOnsite", index, "totalPersons", event.target.value)} />
                    </LabeledField>
                  </div>
                  {form.subcontractorsOnsite.length > 1 ? (
                    <button type="button" onClick={() => removeStructuredValue("subcontractorsOnsite", index)} className="mt-3 text-xs font-semibold text-rose-500">
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addStructuredValue("subcontractorsOnsite", { companyName: "", supervisor: "", totalPersons: "" })} className="acm-btn acm-btn-secondary h-10 px-4">
              Add Subcontractor
            </button>
          </FieldGroup>

          <FieldGroup title="Equipment Used Today">
            <div className="space-y-3">
              {form.equipmentUsed.map((entry, index) => (
                <div key={`equipment-${index}`} className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <LabeledField label="Equipment Type">
                      <input className={fieldClass()} value={entry.equipmentType} onChange={(event) => updateStructuredValue("equipmentUsed", index, "equipmentType", event.target.value)} />
                    </LabeledField>
                    <LabeledField label="Make/Model">
                      <input className={fieldClass()} value={entry.makeModel} onChange={(event) => updateStructuredValue("equipmentUsed", index, "makeModel", event.target.value)} />
                    </LabeledField>
                    <LabeledField label="Type Of Work">
                      <input className={fieldClass()} value={entry.typeOfWork} onChange={(event) => updateStructuredValue("equipmentUsed", index, "typeOfWork", event.target.value)} />
                    </LabeledField>
                    <LabeledField label="Time In Use">
                      <input className={fieldClass()} value={entry.timeInUse} onChange={(event) => updateStructuredValue("equipmentUsed", index, "timeInUse", event.target.value)} />
                    </LabeledField>
                  </div>
                  {form.equipmentUsed.length > 1 ? (
                    <button type="button" onClick={() => removeStructuredValue("equipmentUsed", index)} className="mt-3 text-xs font-semibold text-rose-500">
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addStructuredValue("equipmentUsed", { equipmentType: "", makeModel: "", typeOfWork: "", timeInUse: "" })} className="acm-btn acm-btn-secondary h-10 px-4">
              Add Equipment
            </button>
          </FieldGroup>

          <FieldGroup title="Materials Used Today">
            <div className="space-y-3">
              {form.materialsUsed.map((entry, index) => (
                <div key={`materials-${index}`} className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <LabeledField label="Type">
                      <input className={fieldClass()} value={entry.type} onChange={(event) => updateStructuredValue("materialsUsed", index, "type", event.target.value)} />
                    </LabeledField>
                    <LabeledField label="Amount Used">
                      <input className={fieldClass()} value={entry.amountUsed} onChange={(event) => updateStructuredValue("materialsUsed", index, "amountUsed", event.target.value)} />
                    </LabeledField>
                    <LabeledField label="Amount Remaining">
                      <input className={fieldClass()} value={entry.amountRemaining} onChange={(event) => updateStructuredValue("materialsUsed", index, "amountRemaining", event.target.value)} />
                    </LabeledField>
                  </div>
                  {form.materialsUsed.length > 1 ? (
                    <button type="button" onClick={() => removeStructuredValue("materialsUsed", index)} className="mt-3 text-xs font-semibold text-rose-500">
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addStructuredValue("materialsUsed", { type: "", amountUsed: "", amountRemaining: "" })} className="acm-btn acm-btn-secondary h-10 px-4">
              Add Material
            </button>
          </FieldGroup>
            </>
          ) : null}

          <FieldGroup title="Work Activity Logs">
            {form.workActivities.map((entry, index) => (
              <div key={`work-${index}`} className="flex items-start gap-2">
                <LabeledField label={`Activity ${index + 1}`}>
                  <textarea className={fieldClass()} value={entry} onChange={(event) => updateListValue("workActivities", index, event.target.value)} />
                </LabeledField>
                {form.workActivities.length > 1 ? (
                  <button type="button" onClick={() => removeListValue("workActivities", index)} className="mt-4 text-xs font-semibold text-rose-500">
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            <button type="button" onClick={() => addListValue("workActivities")} className="acm-btn acm-btn-secondary h-10 px-4">
              Add Activity
            </button>
          </FieldGroup>

          <FieldGroup title="Coordination Logs">
            {form.coordinationLogs.map((entry, index) => (
              <div key={`coordination-${index}`} className="flex items-start gap-2">
                <LabeledField label={`Coordination ${index + 1}`}>
                  <textarea className={fieldClass()} value={entry} onChange={(event) => updateListValue("coordinationLogs", index, event.target.value)} />
                </LabeledField>
                {form.coordinationLogs.length > 1 ? (
                  <button type="button" onClick={() => removeListValue("coordinationLogs", index)} className="mt-4 text-xs font-semibold text-rose-500">
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            <button type="button" onClick={() => addListValue("coordinationLogs")} className="acm-btn acm-btn-secondary h-10 px-4">
              Add Coordination Log
            </button>
          </FieldGroup>

          <FieldGroup title="Comments And Signoff">
            <LabeledField label="Comments">
              <textarea className={fieldClass()} value={form.comments} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} />
            </LabeledField>
            <div className="grid gap-3 md:grid-cols-2">
              <LabeledField label="Signoff Name">
                <input className={fieldClass()} value={form.signoffName} onChange={(event) => setForm((current) => ({ ...current, signoffName: event.target.value }))} />
              </LabeledField>
              <LabeledField label="Signoff Role">
                <input className={fieldClass()} value={form.signoffRole} onChange={(event) => setForm((current) => ({ ...current, signoffRole: event.target.value }))} />
              </LabeledField>
            </div>
          </FieldGroup>

          <FieldGroup title="Site Pictures">
            <LabeledField label="Upload Pictures">
              <input type="file" accept="image/*" multiple className={fieldClass()} onChange={onPicturesChange} />
            </LabeledField>
            <div className="grid gap-3 md:grid-cols-2">
              {form.sitePictures.map((image, index) => (
                <div key={`picture-${index}`} className="rounded-[16px] border border-[color:var(--acm-border)] p-3">
                  <img src={image} alt={`Site ${index + 1}`} className="h-36 w-full rounded-[12px] object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        sitePictures: current.sitePictures.filter((_, imageIndex) => imageIndex !== index),
                      }))
                    }
                    className="mt-2 text-xs font-semibold text-rose-500"
                  >
                    Remove Picture
                  </button>
                </div>
              ))}
            </div>
          </FieldGroup>

          <BusyButton type="submit" busy={busy} className="acm-btn acm-btn-primary">
            {form.id ? "Save Report" : "Create Report"}
          </BusyButton>
        </form>
      </Modal>

      <Modal open={Boolean(selectedReport)} title="Field Report Details" onClose={() => setSelectedReport(null)}>
        {selectedReport ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {canEdit(selectedReport) ? (
                <>
                  <button type="button" onClick={() => openEdit(selectedReport)} className="acm-btn acm-btn-secondary h-10 px-4">
                    Edit Report
                  </button>
                  <button type="button" onClick={() => deleteReport(selectedReport)} className="acm-btn acm-btn-secondary h-10 px-4">
                    Delete Report
                  </button>
                </>
              ) : null}
            </div>
            <div className="space-y-2">
              <DetailRow label="Date" value={formatDate(selectedReport.report_date)} />
              <DetailRow label="Time" value={selectedReport.report_time || "-"} />
              <DetailRow label="Location" value={selectedReport.location || "-"} />
              <DetailRow label="Weather" value={selectedReport.weather_conditions || "-"} />
              <DetailRow label="Temperature" value={selectedReport.temperature_range || "-"} />
              <DetailRow label="Impact" value={selectedReport.weather_impact || "-"} />
              <DetailRow label="Comments" value={selectedReport.comments || "-"} />
              <DetailRow label="Signoff" value={`${selectedReport.signoff_name || "-"} | ${selectedReport.signoff_role || "-"}`} />
            </div>

            {useDetailedInspectionForm ? (
              <>
                <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Communications With Public</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(selectedReport.public_communications ?? []).length ? (selectedReport.public_communications ?? []).map((entry, index) => (
                      <div key={`public-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-3 text-sm">
                        <div className="font-semibold">{entry.name || "-"}</div>
                        <div className="mt-1 text-[color:var(--acm-muted-fg)]">{entry.phoneNumber || "-"}</div>
                        <div className="mt-2">{entry.comments || "-"}</div>
                      </div>
                    )) : <div className="text-sm text-[color:var(--acm-muted-fg)]">No public communication entries.</div>}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                    <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Contractor Labor Force</div>
                    <div className="space-y-2 text-sm">
                      {(selectedReport.contractor_labor_force ?? []).length ? (selectedReport.contractor_labor_force ?? []).map((entry, index) => (
                        <div key={`labor-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
                          <div className="font-semibold">{entry.classification || "-"}</div>
                          <div className="mt-1 text-[color:var(--acm-muted-fg)]">{entry.personnel || "-"}</div>
                        </div>
                      )) : <div className="text-[color:var(--acm-muted-fg)]">No labor entries.</div>}
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                    <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Subcontractors Onsite</div>
                    <div className="space-y-2 text-sm">
                      {(selectedReport.subcontractors_onsite ?? []).length ? (selectedReport.subcontractors_onsite ?? []).map((entry, index) => (
                        <div key={`subcontractor-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
                          <div className="font-semibold">{entry.companyName || "-"}</div>
                          <div className="mt-1 text-[color:var(--acm-muted-fg)]">{entry.supervisor || "-"} | {entry.totalPersons || "-"} persons</div>
                        </div>
                      )) : <div className="text-[color:var(--acm-muted-fg)]">No subcontractor entries.</div>}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Work Activity Logs</div>
              <div className="space-y-2 text-sm text-[color:var(--acm-fg)]">
                {(selectedReport.work_activities ?? []).map((entry, index) => (
                  <div key={`work-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
                    {entry.text || "-"}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
              <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Coordination Logs</div>
              <div className="space-y-2 text-sm text-[color:var(--acm-fg)]">
                {(selectedReport.coordination_logs ?? []).map((entry, index) => (
                  <div key={`coordination-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
                    {entry.text || "-"}
                  </div>
                ))}
              </div>
            </div>

            {useDetailedInspectionForm ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Equipment Used Today</div>
                  <div className="space-y-2 text-sm">
                    {(selectedReport.equipment_used ?? []).length ? (selectedReport.equipment_used ?? []).map((entry, index) => (
                      <div key={`equipment-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
                        <div className="font-semibold">{entry.equipmentType || "-"}</div>
                        <div className="mt-1 text-[color:var(--acm-muted-fg)]">{entry.makeModel || "-"} | {entry.typeOfWork || "-"}</div>
                        <div className="mt-1 text-[color:var(--acm-muted-fg)]">Time In Use: {entry.timeInUse || "-"}</div>
                      </div>
                    )) : <div className="text-[color:var(--acm-muted-fg)]">No equipment entries.</div>}
                  </div>
                </div>

                <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                  <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Materials Used Today</div>
                  <div className="space-y-2 text-sm">
                    {(selectedReport.materials_used ?? []).length ? (selectedReport.materials_used ?? []).map((entry, index) => (
                      <div key={`materials-view-${index}`} className="rounded-[14px] border border-[color:var(--acm-border)] px-3 py-2">
                        <div className="font-semibold">{entry.type || "-"}</div>
                        <div className="mt-1 text-[color:var(--acm-muted-fg)]">Used: {entry.amountUsed || "-"}</div>
                        <div className="mt-1 text-[color:var(--acm-muted-fg)]">Remaining: {entry.amountRemaining || "-"}</div>
                      </div>
                    )) : <div className="text-[color:var(--acm-muted-fg)]">No material entries.</div>}
                  </div>
                </div>
              </div>
            ) : null}

            {(selectedReport.site_pictures ?? []).length ? (
              <div className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                <div className="mb-2 text-sm font-semibold text-[color:var(--acm-fg)]">Site Pictures</div>
                <div className="grid gap-3 md:grid-cols-2">
                  {(selectedReport.site_pictures ?? []).map((image, index) => (
                    <img key={`picture-view-${index}`} src={image} alt={`Field report ${index + 1}`} className="h-40 w-full rounded-[14px] object-cover" />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
