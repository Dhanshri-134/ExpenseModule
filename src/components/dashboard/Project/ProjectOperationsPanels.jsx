"use client";

import dynamic from "next/dynamic";
import { useDeferredValue, useMemo, useState } from "react";
import Modal from "@/components/dashboard/Modal";
import { BusyButton } from "@/components/dashboard/DashboardUi";
import { sendJson } from "@/lib/client/apiClient";
import { invalidateApiQuery, useApiQuery } from "@/lib/client/apiQuery";
import { ProjectEstimatesWorkspace } from "@/components/dashboard/Project/ProjectEstimateTemplate";
import { PhoneInput } from "@/shared/forms/PhoneInput";
import { getLocalDateInputValue } from "@/shared/utils/dateTime";
import { fieldReportFormSchema, focusFirstInvalidField, getValidationErrors } from "@/shared/validations/forms";
import { PanelLoadingFallback } from "@/shared/ui/feedback/PanelLoadingFallback";

const FieldReportsArchivePanel = dynamic(
  () => import("@/features/field-reports/components/FieldReportsArchivePanel").then((mod) => mod.FieldReportsArchivePanel),
  { loading: () => <PanelLoadingFallback message="Loading field reports..." /> }
);

const FieldReportDetailsPanel = dynamic(
  () => import("@/features/field-reports/components/FieldReportDetailsPanel").then((mod) => mod.FieldReportDetailsPanel),
  { loading: () => <PanelLoadingFallback message="Loading report details..." /> }
);

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function fieldClass(error = false) {
  return `acm-input mt-0 ${error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" : ""}`.trim();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function LabeledField({ label, fieldName = "", error = "", children }) {
  return (
    <label className="relative block pt-3" data-field={fieldName || undefined}>
      <span className="absolute left-3 top-0 z-10 bg-[color:var(--acm-surface)] px-2 text-xs font-semibold text-[color:var(--acm-muted-fg)]">
        {label}
      </span>
      {children}
      {error ? <span className="mt-2 block text-sm text-rose-700">{error}</span> : null}
    </label>
  );
}

function FieldGroup({ title, subtitle = "", children, className = "" }) {
  return (
    <section className={`space-y-3 ${className}`.trim()}>
      <div>
        <div className="text-base font-semibold text-[color:var(--acm-fg)]">{title}</div>
        {/* {subtitle ? <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">{subtitle}</div> : null} */}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function InlineMessage({ error, message, onDismiss }) {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-500">
        <div className="flex items-start justify-between gap-3">
          <span>{error}</span>
          {onDismiss ? <button type="button" onClick={onDismiss} className="text-sm font-semibold">Close</button> : null}
        </div>
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]">
        <div className="flex items-start justify-between gap-3">
          <span>{message}</span>
          {onDismiss ? <button type="button" onClick={onDismiss} className="text-sm font-semibold">Close</button> : null}
        </div>
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

function matchesSearchQuery(query, ...values) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;
  return values
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") return Object.values(value);
      return [value];
    })
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function SectionHeader({ title, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="text-xl font-bold text-[color:var(--acm-fg)]">{title}</div>
      {action}
    </div>
  );
}

function createFieldReportForm(projectId) {
  return {
    id: "",
    projectId,
    reportDate: getLocalDateInputValue(),
    reportTime: "08:00",
    location: "",
    weatherConditions: "",
    temperatureRange: "",
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

export function ProjectFieldReportsPage({ projectId = "", projectList = [], roleBase = "employee", currentUserId = "" }) {
  const reportsQuery = useApiQuery(projectId ? `/api/field-reports?projectId=${projectId}` : "/api/field-reports");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [form, setForm] = useState(() => createFieldReportForm(projectId));
  const [formErrors, setFormErrors] = useState({});

  const reports = reportsQuery.data?.reports ?? [];
  const availableProjects = projectList.length
    ? projectList
    : projectId
      ? [{ id: projectId, name: reports[0]?.project?.name || "Current Project" }]
      : [];
  const filteredReports = reports.filter((report) =>
    matchesSearchQuery(
      deferredSearchQuery,
      report.location,
      report.report_date,
      report.report_time,
      report.weather_conditions,
      report.temperature_range,
      report.comments,
      report.created_by?.name,
      report.created_by?.user_name,
      report.work_activities?.map((entry) => entry.text),
      report.project?.name,
      report.project?.job_number
    )
  );
  const canManageReports = roleBase === "manager" || roleBase === "owner";
  const useDetailedInspectionForm = canManageReports;
  const canCreateReports = Boolean(projectId || availableProjects.length);

  function canEdit(report) {
    if (!report) return false;
    if (canManageReports) return true;
    return report.created_by_user_id === currentUserId;
  }

  function openCreate() {
    setFormErrors({});
    setForm(createFieldReportForm(projectId || availableProjects[0]?.id || ""));
    setError("");
    setMessage("");
    setOpen(true);
  }

  function openEdit(report) {
    setFormErrors({});
    setForm({
      id: report.id,
      projectId: report.project_id || report.project?.id || "",
      reportDate: report.report_date || getLocalDateInputValue(),
      reportTime: report.report_time || "",
      location: report.location || "",
      weatherConditions: report.weather_conditions || "",
      temperatureRange: report.temperature_range || "",
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
    const nextErrors = getValidationErrors(fieldReportFormSchema, form);
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      focusFirstInvalidField(nextErrors);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setFormErrors({});

    const method = form.id ? "PUT" : "POST";
    try {
      await sendJson("/api/field-reports", {
        method,
        body: form,
      });

      setMessage(form.id ? "Field report updated." : "Field report created.");
      setOpen(false);
      invalidateApiQuery(projectId ? `/api/field-reports?projectId=${projectId}` : "/api/field-reports", { refetchType: "none" });
      await reportsQuery.refresh();
    } catch (requestError) {
      setError(formatApiError(requestError.payload, "field_report_save_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteReport(report) {
    if (!window.confirm(`Delete field report for ${formatDate(report.report_date)}?`)) return;
    setError("");
    setMessage("");
    try {
      await sendJson("/api/field-reports", {
        method: "DELETE",
        body: { id: report.id, projectId: report.project_id },
      });
      setMessage("Field report deleted.");
      if (selectedReport?.id === report.id) setSelectedReport(null);
      invalidateApiQuery(projectId ? `/api/field-reports?projectId=${projectId}` : "/api/field-reports", { refetchType: "none" });
      await reportsQuery.refresh();
    } catch (requestError) {
      setError(formatApiError(requestError.payload, "field_report_delete_failed"));
    }
  }

  return (
    <>
      <SectionHeader />

      <InlineMessage error={reportsQuery.error || error} message={message} onDismiss={() => { setError(""); setMessage(""); }} />

      <FieldReportsArchivePanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        canCreateReports={canCreateReports}
        onCreate={openCreate}
        filteredReports={filteredReports}
        canEdit={canEdit}
        onSelectReport={setSelectedReport}
        onEditReport={openEdit}
        onDeleteReport={deleteReport}
        formatDate={formatDate}
      />

      <Modal open={open} title={form.id ? "Edit Field Report" : "Create Field Report"} onClose={() => setOpen(false)} maxWidth="max-w-6xl">
        <form onSubmit={saveReport} className="grid gap-6">
          <FieldGroup title="Report Details" subtitle="Set the project, report timing, site conditions, and weather summary.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <LabeledField label="Project" fieldName="projectId" error={formErrors.projectId}>
                <select
                  name="projectId"
                  className={fieldClass(Boolean(formErrors.projectId))}
                  value={form.projectId}
                  onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}
                >
                  <option value="">Select project</option>
                  {availableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <LabeledField label="Report Date" fieldName="reportDate" error={formErrors.reportDate}>
                <input name="reportDate" type="date" className={fieldClass(Boolean(formErrors.reportDate))} value={form.reportDate} onChange={(event) => setForm((current) => ({ ...current, reportDate: event.target.value }))} />
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
                  <LabeledField label="Temperature Value" fieldName="temperatureValue" error={formErrors.temperatureValue}>
                    <input name="temperatureValue" inputMode="decimal" className={`${fieldClass(Boolean(formErrors.temperatureValue))} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} value={form.temperatureValue} onChange={(event) => setForm((current) => ({ ...current, temperatureValue: event.target.value, temperatureRange: "" }))} />
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
                  <input className={fieldClass()} value={form.temperatureRange} onChange={(event) => setForm((current) => ({ ...current, temperatureRange: event.target.value, temperatureValue: "", temperatureUnit: "F" }))} />
                </LabeledField>
              )}
              <LabeledField label="Weather Impact">
                <input className={fieldClass()} value={form.weatherImpact} onChange={(event) => setForm((current) => ({ ...current, weatherImpact: event.target.value }))} />
              </LabeledField>
            </div>
          </FieldGroup>

          {useDetailedInspectionForm ? (
            <>
          <FieldGroup title="Communications With Public" subtitle="Record who was contacted, their phone number, and any site-related notes.">
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
                      <PhoneInput className={fieldClass()} value={entry.phoneNumber} onValueChange={(value) => updateStructuredValue("publicCommunications", index, "phoneNumber", value)} />
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

          <FieldGroup title="Contractor Labor Force" subtitle="List crew classifications and the personnel on site for the day.">
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

          <FieldGroup title="Subcontractors Onsite" subtitle="Capture each subcontractor team, supervisor, and total headcount.">
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

          <FieldGroup title="Equipment Used Today" subtitle="Track the equipment used, model details, work type, and time in use.">
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

          <FieldGroup title="Materials Used Today" subtitle="Summarize materials consumed on site and what remains available.">
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

          <FieldGroup title="Work Activity Logs" subtitle="Describe the work completed and major progress updates from the field.">
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

          <FieldGroup title="Coordination Logs" subtitle="Note coordination items, dependencies, and follow-ups with the team.">
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

          <FieldGroup title="Comments And Signoff" subtitle="Add final remarks and confirm who is signing off on the report.">
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

          <FieldGroup title="Site Pictures" subtitle="Upload photos that document field progress, conditions, and observations.">
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
        <FieldReportDetailsPanel
          selectedReport={selectedReport}
          canEdit={canEdit}
          onEdit={openEdit}
          onDelete={deleteReport}
          useDetailedInspectionForm={useDetailedInspectionForm}
          formatDate={formatDate}
        />
      </Modal>
    </>
  );
}

export function FieldReportsWorkspacePage({ roleBase = "owner", currentUserId = "" }) {
  const projectsQuery = useApiQuery("/api/projects");
  const projectList = useMemo(() => projectsQuery.data?.projects ?? [], [projectsQuery.data?.projects]);

  return (
    <div className="space-y-4">
      {projectList.length ? (
        <ProjectFieldReportsPage projectList={projectList} roleBase={roleBase} currentUserId={currentUserId} />
      ) : (
        <div className={cardClass()}>No projects available yet.</div>
      )}
    </div>
  );
}

