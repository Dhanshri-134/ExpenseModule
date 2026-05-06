"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/dashboard/Modal";
import { BusyButton, CompactListRow } from "@/components/dashboard/DashboardUi";
import { invalidateApiQuery, useApiQuery } from "@/lib/client/apiQuery";

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

function formatCurrency(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatPercent(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0%";
  return `${amount}%`;
}

function formatApiError(json, fallback) {
  if (json?.detail?.fieldErrors) {
    const fieldMessages = Object.values(json.detail.fieldErrors).flat().filter(Boolean);
    if (fieldMessages.length) return fieldMessages[0];
  }

  if (typeof json?.detail === "string" && json.detail.trim()) return json.detail;
  if (typeof json?.error === "string" && json.error.trim()) return json.error;
  return fallback;
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPercent(value) {
  const parsed = toNumber(value);
  return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
}

function percentInput(value) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed) > 1 ? parsed : parsed * 100;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRateRow() {
  return {
    id: createId("rate"),
    name: "",
    value: "",
  };
}

function createLaborEntry() {
  return {
    id: createId("labor"),
    title: "",
    classification: "",
    baseWage: "",
    rates: [createRateRow()],
    stHours: "",
    stRate: "",
    otHours: "",
    otRate: "",
    straightTimePersons: "",
    straightTimeDays: "",
    overtimePersons: "",
    overtimeDays: "",
    targetWage: "",
    prevailWage: "",
  };
}

function createMaterialEntry() {
  return {
    id: createId("material"),
    code: "",
    description: "",
    quantity: "",
    uom: "",
    wastePercent: "",
    unitRate: "",
    freight: "",
    taxPercent: "",
  };
}

function createEquipmentEntry() {
  return {
    id: createId("equipment"),
    code: "",
    description: "",
    quantity: "",
    rentalDays: "",
    unitRate: "",
    freight: "",
    fuelPercent: "",
    taxPercent: "",
  };
}

function createOverheadEntry() {
  return {
    id: createId("overhead"),
    code: "",
    description: "",
    quantity: "",
    uom: "",
    unitRate: "",
    days: "",
    taxPercent: "",
  };
}

function createCostLine(index = 1) {
  return {
    id: createId("cost-line"),
    code: "",
    name: `Cost Line ${index}`,
    description: "",
    overheadPercent: "",
    profitPercent: "",
    commissionPercent: "",
    riskPercent: "",
    inflationRate: "",
    escalationYears: "",
    laborEntries: [createLaborEntry()],
    materialEntries: [createMaterialEntry()],
    equipmentEntries: [createEquipmentEntry()],
    overheadEntries: [createOverheadEntry()],
  };
}

function createEstimateForm(projectId) {
  return {
    id: "",
    projectId,
    title: "",
    estimateDate: new Date().toISOString().slice(0, 10),
    status: "draft",
    notes: "",
    overheadPercent: "10",
    profitPercent: "10",
    commissionPercent: "0",
    riskPercent: "0",
    inflationRate: "0",
    escalationYears: "0",
    costLines: [createCostLine(1)],
  };
}

function buildEstimateTitle(estimate) {
  if (!estimate) return "Estimate";
  return estimate.estimate_number ? `Estimate #${estimate.estimate_number}` : estimate.title || "Estimate";
}

function buildLaborMeta(entry) {
  const baseWage = toNumber(entry.baseWage);
  const totalRatePercent = (entry.rates ?? []).reduce((sum, rate) => sum + toNumber(rate.value), 0);
  const derivedStraightRate = toNumber(entry.stRate) || baseWage * (1 + totalRatePercent / 100);
  const derivedOvertimeRate = toNumber(entry.otRate) || derivedStraightRate * 1.5;
  const targetPay = toNumber(entry.stHours) * toNumber(entry.targetWage);
  const prevailPay = toNumber(entry.stHours) * toNumber(entry.prevailWage);

  return {
    title: entry.title,
    classification: entry.classification,
    baseWage,
    rates: (entry.rates ?? []).map((rate) => ({
      name: rate.name,
      value: toNumber(rate.value),
    })),
    straightTimePersons: toNumber(entry.straightTimePersons),
    straightTimeDays: toNumber(entry.straightTimeDays),
    overtimePersons: toNumber(entry.overtimePersons),
    overtimeDays: toNumber(entry.overtimeDays),
    targetWage: toNumber(entry.targetWage),
    prevailWage: toNumber(entry.prevailWage),
    targetPay,
    prevailPay,
    derivedStraightRate,
    derivedOvertimeRate,
  };
}

function buildPayload(form) {
  return {
    id: form.id || undefined,
    projectId: form.projectId,
    title: form.title,
    estimateDate: form.estimateDate,
    status: form.status,
    notes: form.notes,
    overheadPercent: form.overheadPercent,
    profitPercent: form.profitPercent,
    commissionPercent: form.commissionPercent,
    riskPercent: form.riskPercent,
    inflationRate: form.inflationRate,
    escalationYears: form.escalationYears,
    costCodes: form.costLines.map((line) => ({
      code: line.code,
      name: line.name,
      description: line.description,
      overheadPercent: line.overheadPercent || form.overheadPercent,
      profitPercent: line.profitPercent || form.profitPercent,
      commissionPercent: line.commissionPercent || form.commissionPercent,
      riskPercent: line.riskPercent || form.riskPercent,
      inflationRate: line.inflationRate || form.inflationRate,
      escalationYears: line.escalationYears || form.escalationYears,
      laborEntries: line.laborEntries.map((entry) => {
        const meta = buildLaborMeta(entry);
        return {
          id: entry.id,
          description: entry.title,
          stHours: entry.stHours,
          stRate: meta.derivedStraightRate,
          otHours: entry.otHours,
          otRate: meta.derivedOvertimeRate,
          metadata: meta,
        };
      }),
      materialEntries: line.materialEntries.map((entry) => {
        const quantity = toNumber(entry.quantity);
        const wastePercent = toNumber(entry.wastePercent);
        return {
          id: entry.id,
          description: entry.description,
          quantity,
          wastePercent,
          unitRate: entry.unitRate,
          freight: entry.freight,
          taxPercent: entry.taxPercent,
          metadata: {
            code: entry.code,
            uom: entry.uom,
            wasteQty: quantity * toPercent(wastePercent),
          },
        };
      }),
      equipmentEntries: line.equipmentEntries.map((entry) => {
        const quantity = toNumber(entry.quantity);
        const rentalDays = toNumber(entry.rentalDays);
        const unitRate = toNumber(entry.unitRate);
        const freight = toNumber(entry.freight);
        const baseCost = quantity * rentalDays * unitRate;
        const costWithFreight = baseCost + freight;
        const fuelPercent = toNumber(entry.fuelPercent);
        const fuelAmount = costWithFreight * toPercent(fuelPercent);
        return {
          id: entry.id,
          description: entry.description,
          qty: quantity,
          days: rentalDays,
          rate: unitRate,
          freight,
          fuel: fuelAmount,
          taxPercent: entry.taxPercent,
          metadata: {
            code: entry.code,
            fuelPercent,
            costWithFuel: costWithFreight + fuelAmount,
          },
        };
      }),
      overheadEntries: line.overheadEntries.map((entry) => ({
        id: entry.id,
        description: entry.description,
        qty: entry.quantity,
        days: entry.days,
        rate: entry.unitRate,
        taxPercent: entry.taxPercent,
        metadata: {
          code: entry.code,
          uom: entry.uom,
        },
      })),
    })),
  };
}

function formFromEstimate(estimate, projectId) {
  return {
    id: estimate.id,
    projectId,
    title: estimate.title || "",
    estimateDate: estimate.estimate_date || new Date().toISOString().slice(0, 10),
    status: estimate.status || "draft",
    notes: estimate.notes || "",
    overheadPercent: String(percentInput(estimate.summary?.overheadPercent ?? estimate.overhead_percent ?? 0)),
    profitPercent: String(percentInput(estimate.summary?.profitPercent ?? estimate.profit_percent ?? 0)),
    commissionPercent: String(percentInput(estimate.summary?.commissionPercent ?? estimate.commission_percent ?? 0)),
    riskPercent: String(percentInput(estimate.summary?.riskPercent ?? estimate.risk_percent ?? 0)),
    inflationRate: String(percentInput(estimate.summary?.inflationRate ?? estimate.inflation_rate ?? 0)),
    escalationYears: String(toNumber(estimate.summary?.escalationYears ?? estimate.escalation_years ?? 0)),
    costLines:
      (estimate.cost_codes ?? []).length
        ? estimate.cost_codes.map((line, index) => ({
            id: line.id || createId("cost-line"),
            code: line.costCode?.code || "",
            name: line.costCode?.name || `Cost Line ${index + 1}`,
            description: line.costCode?.description || "",
            overheadPercent: String(percentInput(line.overheadPercent ?? 0)),
            profitPercent: String(percentInput(line.profitPercent ?? 0)),
            commissionPercent: String(percentInput(line.commissionPercent ?? 0)),
            riskPercent: String(percentInput(line.riskPercent ?? 0)),
            inflationRate: String(percentInput(line.inflationRate ?? 0)),
            escalationYears: String(toNumber(line.escalationYears ?? 0)),
            laborEntries:
              (line.laborEntries ?? []).length
                ? line.laborEntries.map((entry) => ({
                    id: entry.id || createId("labor"),
                    title: entry.metadata?.title || entry.description || "",
                    classification: entry.metadata?.classification || "",
                    baseWage: entry.metadata?.baseWage ?? "",
                    rates:
                      (entry.metadata?.rates ?? []).length
                        ? entry.metadata.rates.map((rate) => ({
                            id: createId("rate"),
                            name: rate.name || "",
                            value: rate.value ?? "",
                          }))
                        : [createRateRow()],
                    stHours: entry.stHours ?? "",
                    stRate: entry.stRate ?? "",
                    otHours: entry.otHours ?? "",
                    otRate: entry.otRate ?? "",
                    straightTimePersons: entry.metadata?.straightTimePersons ?? "",
                    straightTimeDays: entry.metadata?.straightTimeDays ?? "",
                    overtimePersons: entry.metadata?.overtimePersons ?? "",
                    overtimeDays: entry.metadata?.overtimeDays ?? "",
                    targetWage: entry.metadata?.targetWage ?? "",
                    prevailWage: entry.metadata?.prevailWage ?? "",
                  }))
                : [createLaborEntry()],
            materialEntries:
              (line.materialEntries ?? []).length
                ? line.materialEntries.map((entry) => ({
                    id: entry.id || createId("material"),
                    code: entry.metadata?.code || "",
                    description: entry.description || "",
                    quantity: entry.quantity ?? "",
                    uom: entry.metadata?.uom || "",
                    wastePercent: percentInput(entry.wastePercent ?? 0),
                    unitRate: entry.unitRate ?? "",
                    freight: entry.freight ?? "",
                    taxPercent: percentInput(entry.taxPercent ?? 0),
                  }))
                : [createMaterialEntry()],
            equipmentEntries:
              (line.equipmentEntries ?? []).length
                ? line.equipmentEntries.map((entry) => ({
                    id: entry.id || createId("equipment"),
                    code: entry.metadata?.code || "",
                    description: entry.description || "",
                    quantity: entry.qty ?? "",
                    rentalDays: entry.days ?? "",
                    unitRate: entry.rate ?? "",
                    freight: entry.freight ?? "",
                    fuelPercent: entry.metadata?.fuelPercent ?? "",
                    taxPercent: percentInput(entry.taxPercent ?? 0),
                  }))
                : [createEquipmentEntry()],
            overheadEntries:
              (line.overheadEntries ?? []).length
                ? line.overheadEntries.map((entry) => ({
                    id: entry.id || createId("overhead"),
                    code: entry.metadata?.code || "",
                    description: entry.description || "",
                    quantity: entry.qty ?? "",
                    uom: entry.metadata?.uom || "",
                    unitRate: entry.rate ?? "",
                    days: entry.days ?? "",
                    taxPercent: percentInput(entry.taxPercent ?? 0),
                  }))
                : [createOverheadEntry()],
          }))
        : [createCostLine(1)],
  };
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2 text-sm last:border-b-0">
      <div className="font-semibold text-[color:var(--acm-muted-fg)]">{label}</div>
      <div className="text-[color:var(--acm-fg)]">{value || "-"}</div>
    </div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="text-xl font-bold text-[color:var(--acm-fg)]">{title}</div>
      {action}
    </div>
  );
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

function EstimateSummaryCard({ summary }) {
  return (
    <div className={cardClass("h-full")}>
      <div className="text-lg font-bold text-[color:var(--acm-fg)]">Estimate Summary</div>
      <div className="mt-4 space-y-2 text-sm">
        <DetailRow label="Labor" value={formatCurrency(summary.laborCost)} />
        <DetailRow label="Material" value={formatCurrency(summary.materialCost)} />
        <DetailRow label="Equipment" value={formatCurrency(summary.equipmentCost)} />
        <DetailRow label="Overhead" value={formatCurrency(summary.directOverheadCost)} />
        <DetailRow label="Base Cost" value={formatCurrency(summary.baseCost)} />
        <DetailRow label="Markup" value={`${formatPercent(percentInput(summary.overheadPercent))} / ${formatPercent(percentInput(summary.profitPercent))} / ${formatPercent(percentInput(summary.commissionPercent))}`} />
        <DetailRow label="Future Cost" value={formatCurrency(summary.futureCost || 0)} />
        <DetailRow label="Final Bid" value={formatCurrency(summary.finalBid || summary.totalPrice || 0)} />
      </div>
    </div>
  );
}

function LineSection({ title, subtitle, children, action, defaultOpen = true }) {
  return (
    <details open={defaultOpen} className="rounded-[20px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
        <div>
          <div className="text-sm font-bold text-[color:var(--acm-fg)]">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-[color:var(--acm-muted-fg)]">{subtitle}</div> : null}
        </div>
        {action}
      </summary>
      <div className="border-t border-[color:var(--acm-border)] p-4">{children}</div>
    </details>
  );
}

export function ProjectEstimatesWorkspace({ projectId, canManage = false }) {
  const estimatesQuery = useApiQuery(projectId ? `/api/estimates?projectId=${projectId}` : null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [previewSummary, setPreviewSummary] = useState({
    laborCost: 0,
    materialCost: 0,
    equipmentCost: 0,
    directOverheadCost: 0,
    baseCost: 0,
    finalBid: 0,
    totalPrice: 0,
  });
  const [form, setForm] = useState(() => createEstimateForm(projectId));

  const estimates = estimatesQuery.data?.estimates ?? [];

  const payload = useMemo(() => buildPayload(form), [form]);

  useEffect(() => {
    if (!open || !projectId) return undefined;

    let active = true;

    async function previewEstimate() {
      const res = await fetch("/api/estimates/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!active) return;
      if (!res.ok) {
        setPreviewSummary({
          laborCost: 0,
          materialCost: 0,
          equipmentCost: 0,
          directOverheadCost: 0,
          baseCost: 0,
          finalBid: 0,
          totalPrice: 0,
        });
        return;
      }
      setPreviewSummary(json?.summary || {});
    }

    previewEstimate();
    return () => {
      active = false;
    };
  }, [open, payload, projectId]);

  function openCreate() {
    setForm(createEstimateForm(projectId));
    setSelectedEstimate(null);
    setError("");
    setMessage("");
    setOpen(true);
  }

  function openEdit(estimate) {
    setForm(formFromEstimate(estimate, projectId));
    setPreviewSummary(estimate.summary || {});
    setSelectedEstimate(null);
    setError("");
    setMessage("");
    setOpen(true);
  }

  function updateRoot(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateCostLine(lineId, key, value) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) => (line.id === lineId ? { ...line, [key]: value } : line)),
    }));
  }

  function updateNestedEntry(lineId, groupKey, entryId, key, value) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [groupKey]: line[groupKey].map((entry) => (entry.id === entryId ? { ...entry, [key]: value } : entry)),
            }
          : line
      ),
    }));
  }

  function updateLaborRate(lineId, laborId, rateId, key, value) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              laborEntries: line.laborEntries.map((entry) =>
                entry.id === laborId
                  ? {
                      ...entry,
                      rates: entry.rates.map((rate) => (rate.id === rateId ? { ...rate, [key]: value } : rate)),
                    }
                  : entry
              ),
            }
          : line
      ),
    }));
  }

  function addCostLine() {
    setForm((current) => ({
      ...current,
      costLines: [...current.costLines, createCostLine(current.costLines.length + 1)],
    }));
  }

  function removeCostLine(lineId) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.length > 1 ? current.costLines.filter((line) => line.id !== lineId) : current.costLines,
    }));
  }

  function addNestedEntry(lineId, groupKey, factory) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) =>
        line.id === lineId ? { ...line, [groupKey]: [...line[groupKey], factory()] } : line
      ),
    }));
  }

  function removeNestedEntry(lineId, groupKey, entryId) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) =>
        line.id === lineId && line[groupKey].length > 1
          ? { ...line, [groupKey]: line[groupKey].filter((entry) => entry.id !== entryId) }
          : line
      ),
    }));
  }

  function addLaborRate(lineId, laborId) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              laborEntries: line.laborEntries.map((entry) =>
                entry.id === laborId ? { ...entry, rates: [...entry.rates, createRateRow()] } : entry
              ),
            }
          : line
      ),
    }));
  }

  function removeLaborRate(lineId, laborId, rateId) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              laborEntries: line.laborEntries.map((entry) =>
                entry.id === laborId && entry.rates.length > 1
                  ? { ...entry, rates: entry.rates.filter((rate) => rate.id !== rateId) }
                  : entry
              ),
            }
          : line
      ),
    }));
  }

  async function saveEstimate(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");

    const method = form.id ? "PUT" : "POST";
    const res = await fetch("/api/estimates", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setError(formatApiError(json, "estimate_save_failed"));
      setBusy(false);
      return;
    }

    setMessage(form.id ? "Estimate updated." : "Estimate created.");
    setOpen(false);
    invalidateApiQuery(`/api/estimates?projectId=${projectId}`);
    invalidateApiQuery("/api/estimates-index");
    await estimatesQuery.refresh();
    setBusy(false);
  }

  async function deleteEstimate(estimate) {
    if (!window.confirm(`Delete ${buildEstimateTitle(estimate)}?`)) return;
    setError("");
    setMessage("");
    const res = await fetch("/api/estimates", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: estimate.id, projectId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(formatApiError(json, "estimate_delete_failed"));
      return;
    }

    setMessage("Estimate deleted.");
    setSelectedEstimate(null);
    invalidateApiQuery(`/api/estimates?projectId=${projectId}`);
    invalidateApiQuery("/api/estimates-index");
    await estimatesQuery.refresh();
  }

  function exportEstimate(estimate, type) {
    window.open(`/api/estimates?projectId=${projectId}&id=${estimate.id}&export=${type}`, "_self");
  }

  return (
    <>
      <SectionHeader
        title="Estimate Template"
        action={
          canManage ? (
            <button type="button" onClick={openCreate} className="acm-btn acm-btn-primary h-10 px-4">
              New Estimate
            </button>
          ) : null
        }
      />

      <InlineMessage error={estimatesQuery.error || error} message={message} />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className={cardClass()}>
          <div className="mb-4">
            <div className="text-lg font-bold text-[color:var(--acm-fg)]">Estimate Register</div>
            <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">
              Full labor, material, equipment, and overhead estimate templates for this project.
            </div>
          </div>

          <div className="space-y-3">
            {!estimates.length ? (
              <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-6 text-sm text-[color:var(--acm-muted-fg)]">
                No estimates recorded for this project yet.
              </div>
            ) : null}

            {estimates.map((estimate) => (
              <CompactListRow
                key={estimate.id}
                primary={estimate.title || buildEstimateTitle(estimate)}
                secondary={`#${estimate.estimate_number} | ${formatDate(estimate.estimate_date)} | ${estimate.status}`}
                tertiary={`${formatCurrency(estimate.summary?.finalBid || estimate.summary?.totalPrice || 0)} | Prepared by ${estimate.prepared_by?.name || estimate.prepared_by?.user_name || estimate.prepared_by?.user_code || "-"}`}
                onClick={() => setSelectedEstimate(estimate)}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        exportEstimate(estimate, "pdf");
                      }}
                      className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        exportEstimate(estimate, "csv");
                      }}
                      className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
                    >
                      CSV
                    </button>
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(estimate);
                          }}
                          className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteEstimate(estimate);
                          }}
                          className="acm-btn acm-btn-secondary h-9 px-3 text-xs"
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                }
              />
            ))}
          </div>
        </div>

        <EstimateSummaryCard summary={estimates[0]?.summary || previewSummary} />
      </div>

      <Modal open={open} title={form.id ? "Edit Estimate" : "Create Estimate"} onClose={() => setOpen(false)}>
        <form onSubmit={saveEstimate} className="grid gap-4">
          <FieldGroup title="Basic Details">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <LabeledField label="Estimate Title">
                <input className={fieldClass()} value={form.title} onChange={(event) => updateRoot("title", event.target.value)} />
              </LabeledField>
              <LabeledField label="Estimate Date">
                <input type="date" className={fieldClass()} value={form.estimateDate} onChange={(event) => updateRoot("estimateDate", event.target.value)} />
              </LabeledField>
              <LabeledField label="Status">
                <select className={fieldClass()} value={form.status} onChange={(event) => updateRoot("status", event.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="review">In Review</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                </select>
              </LabeledField>
              <LabeledField label="Notes">
                <input className={fieldClass()} value={form.notes} onChange={(event) => updateRoot("notes", event.target.value)} />
              </LabeledField>
            </div>
          </FieldGroup>

          <FieldGroup title="Estimate Markup">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <LabeledField label="Overhead %">
                <input className={fieldClass()} inputMode="decimal" value={form.overheadPercent} onChange={(event) => updateRoot("overheadPercent", event.target.value)} />
              </LabeledField>
              <LabeledField label="Profit %">
                <input className={fieldClass()} inputMode="decimal" value={form.profitPercent} onChange={(event) => updateRoot("profitPercent", event.target.value)} />
              </LabeledField>
              <LabeledField label="Commission %">
                <input className={fieldClass()} inputMode="decimal" value={form.commissionPercent} onChange={(event) => updateRoot("commissionPercent", event.target.value)} />
              </LabeledField>
              <LabeledField label="Risk %">
                <input className={fieldClass()} inputMode="decimal" value={form.riskPercent} onChange={(event) => updateRoot("riskPercent", event.target.value)} />
              </LabeledField>
              <LabeledField label="Inflation %">
                <input className={fieldClass()} inputMode="decimal" value={form.inflationRate} onChange={(event) => updateRoot("inflationRate", event.target.value)} />
              </LabeledField>
              <LabeledField label="Escalation Years">
                <input className={fieldClass()} inputMode="decimal" value={form.escalationYears} onChange={(event) => updateRoot("escalationYears", event.target.value)} />
              </LabeledField>
            </div>
          </FieldGroup>

          <FieldGroup title="Estimate Template">
            <div className="space-y-4">
              {form.costLines.map((line, lineIndex) => (
                <LineSection
                  key={line.id}
                  title={line.name || `Cost Line ${lineIndex + 1}`}
                  subtitle={`${line.code || "No code"} | ${line.description || "No description yet"}`}
                  action={
                    form.costLines.length > 1 ? (
                      <button type="button" onClick={() => removeCostLine(line.id)} className="text-xs font-semibold text-rose-500">
                        Remove Cost Line
                      </button>
                    ) : null
                  }
                >
                  <div className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <LabeledField label="Title">
                        <input className={fieldClass()} value={line.name} onChange={(event) => updateCostLine(line.id, "name", event.target.value)} />
                      </LabeledField>
                      <LabeledField label="Code">
                        <input className={fieldClass()} value={line.code} onChange={(event) => updateCostLine(line.id, "code", event.target.value)} />
                      </LabeledField>
                      <LabeledField label="Description">
                        <input className={fieldClass()} value={line.description} onChange={(event) => updateCostLine(line.id, "description", event.target.value)} />
                      </LabeledField>
                    </div>

                    <LineSection title="Labor" subtitle="Classification, rates, time, wage targets, and payroll detail">
                      <div className="space-y-4">
                        {line.laborEntries.map((entry, index) => {
                          const meta = buildLaborMeta(entry);
                          const totalAmount = toNumber(entry.stHours) * meta.derivedStraightRate + toNumber(entry.otHours) * meta.derivedOvertimeRate;
                          return (
                            <div key={entry.id} className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Labor Line {index + 1}</div>
                                {line.laborEntries.length > 1 ? (
                                  <button type="button" onClick={() => removeNestedEntry(line.id, "laborEntries", entry.id)} className="text-xs font-semibold text-rose-500">
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <LabeledField label="Title">
                                  <input className={fieldClass()} value={entry.title} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "title", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Classification (Category)">
                                  <input className={fieldClass()} value={entry.classification} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "classification", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Base Wage ($)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.baseWage} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "baseWage", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Target Wage ($)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.targetWage} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "targetWage", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Prevail Wage ($)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.prevailWage} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "prevailWage", event.target.value)} />
                                </LabeledField>
                              </div>

                              <div className="mt-4 rounded-[16px] border border-[color:var(--acm-border)] p-4">
                                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">Rates</div>
                                <div className="space-y-3">
                                  {entry.rates.map((rate) => (
                                    <div key={rate.id} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                                      <LabeledField label="Rate Name">
                                        <input className={fieldClass()} value={rate.name} onChange={(event) => updateLaborRate(line.id, entry.id, rate.id, "name", event.target.value)} />
                                      </LabeledField>
                                      <LabeledField label="Value (%)">
                                        <input className={fieldClass()} inputMode="decimal" value={rate.value} onChange={(event) => updateLaborRate(line.id, entry.id, rate.id, "value", event.target.value)} />
                                      </LabeledField>
                                      <div className="pt-3">
                                        {entry.rates.length > 1 ? (
                                          <button type="button" onClick={() => removeLaborRate(line.id, entry.id, rate.id)} className="acm-btn acm-btn-secondary h-11 px-4">
                                            Remove
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <button type="button" onClick={() => addLaborRate(line.id, entry.id)} className="acm-btn acm-btn-secondary mt-3 h-10 px-4">
                                  Add Rate
                                </button>
                              </div>

                              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <LabeledField label="Straight Time Hours">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.stHours} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "stHours", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Straight Time Rate">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.stRate || meta.derivedStraightRate} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "stRate", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Overtime Hours">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.otHours} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "otHours", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Overtime Rate">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.otRate || meta.derivedOvertimeRate} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "otRate", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Straight Time Person Count">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.straightTimePersons} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "straightTimePersons", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Straight Time Days">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.straightTimeDays} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "straightTimeDays", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Overtime Person Count">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.overtimePersons} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "overtimePersons", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Overtime Days">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.overtimeDays} onChange={(event) => updateNestedEntry(line.id, "laborEntries", entry.id, "overtimeDays", event.target.value)} />
                                </LabeledField>
                              </div>

                              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm">
                                  <div className="font-semibold text-[color:var(--acm-muted-fg)]">Total Amount</div>
                                  <div className="mt-1 text-lg font-bold text-[color:var(--acm-fg)]">{formatCurrency(totalAmount)}</div>
                                </div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm">
                                  <div className="font-semibold text-[color:var(--acm-muted-fg)]">Target Pay</div>
                                  <div className="mt-1 text-lg font-bold text-[color:var(--acm-fg)]">{formatCurrency(meta.targetPay)}</div>
                                </div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm">
                                  <div className="font-semibold text-[color:var(--acm-muted-fg)]">Prevail Pay</div>
                                  <div className="mt-1 text-lg font-bold text-[color:var(--acm-fg)]">{formatCurrency(meta.prevailPay)}</div>
                                </div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm">
                                  <div className="font-semibold text-[color:var(--acm-muted-fg)]">Derived ST / OT</div>
                                  <div className="mt-1 text-sm font-bold text-[color:var(--acm-fg)]">{formatCurrency(meta.derivedStraightRate)} / {formatCurrency(meta.derivedOvertimeRate)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button type="button" onClick={() => addNestedEntry(line.id, "laborEntries", createLaborEntry)} className="acm-btn acm-btn-secondary h-10 px-4">
                        Add Other Labor
                      </button>
                    </LineSection>

                    <LineSection title="Material" subtitle="Code, quantity, waste, freight, tax, and totals">
                      <div className="space-y-4">
                        {line.materialEntries.map((entry, index) => {
                          const quantity = toNumber(entry.quantity);
                          const wastePercent = toNumber(entry.wastePercent);
                          const unitRate = toNumber(entry.unitRate);
                          const freight = toNumber(entry.freight);
                          const taxPercent = toNumber(entry.taxPercent);
                          const wasteQty = quantity * toPercent(wastePercent);
                          const adjustedQty = quantity + wasteQty;
                          const cost = adjustedQty * unitRate;
                          const costWithFreight = cost + freight;
                          const costWithTax = costWithFreight * toPercent(taxPercent);
                          const total = costWithFreight + costWithTax;
                          return (
                            <div key={entry.id} className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Material Line {index + 1}</div>
                                {line.materialEntries.length > 1 ? (
                                  <button type="button" onClick={() => removeNestedEntry(line.id, "materialEntries", entry.id)} className="text-xs font-semibold text-rose-500">
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <LabeledField label="Code">
                                  <input className={fieldClass()} value={entry.code} onChange={(event) => updateNestedEntry(line.id, "materialEntries", entry.id, "code", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Description">
                                  <input className={fieldClass()} value={entry.description} onChange={(event) => updateNestedEntry(line.id, "materialEntries", entry.id, "description", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Quantity">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.quantity} onChange={(event) => updateNestedEntry(line.id, "materialEntries", entry.id, "quantity", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="UOM">
                                  <input className={fieldClass()} value={entry.uom} onChange={(event) => updateNestedEntry(line.id, "materialEntries", entry.id, "uom", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Waste %">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.wastePercent} onChange={(event) => updateNestedEntry(line.id, "materialEntries", entry.id, "wastePercent", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Unit Rate ($)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.unitRate} onChange={(event) => updateNestedEntry(line.id, "materialEntries", entry.id, "unitRate", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Freight ($)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.freight} onChange={(event) => updateNestedEntry(line.id, "materialEntries", entry.id, "freight", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Tax (%)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.taxPercent} onChange={(event) => updateNestedEntry(line.id, "materialEntries", entry.id, "taxPercent", event.target.value)} />
                                </LabeledField>
                              </div>
                              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Waste Qty</div><div className="mt-1 font-bold">{wasteQty.toFixed(2)}</div></div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Cost</div><div className="mt-1 font-bold">{formatCurrency(cost)}</div></div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Cost w/ Freight</div><div className="mt-1 font-bold">{formatCurrency(costWithFreight)}</div></div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Cost w/ Tax</div><div className="mt-1 font-bold">{formatCurrency(costWithTax)}</div></div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Total</div><div className="mt-1 font-bold">{formatCurrency(total)}</div></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button type="button" onClick={() => addNestedEntry(line.id, "materialEntries", createMaterialEntry)} className="acm-btn acm-btn-secondary h-10 px-4">
                        Add Other Material
                      </button>
                    </LineSection>

                    <LineSection title="Equipment" subtitle="Rental time, fuel loading, freight, tax, and total">
                      <div className="space-y-4">
                        {line.equipmentEntries.map((entry, index) => {
                          const quantity = toNumber(entry.quantity);
                          const rentalDays = toNumber(entry.rentalDays);
                          const unitRate = toNumber(entry.unitRate);
                          const freight = toNumber(entry.freight);
                          const fuelPercent = toNumber(entry.fuelPercent);
                          const taxPercent = toNumber(entry.taxPercent);
                          const cost = quantity * rentalDays * unitRate;
                          const costWithFreight = cost + freight;
                          const costWithFuel = costWithFreight + costWithFreight * toPercent(fuelPercent);
                          const costWithTax = costWithFuel * toPercent(taxPercent);
                          const total = costWithFuel + costWithTax;
                          return (
                            <div key={entry.id} className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Equipment Line {index + 1}</div>
                                {line.equipmentEntries.length > 1 ? (
                                  <button type="button" onClick={() => removeNestedEntry(line.id, "equipmentEntries", entry.id)} className="text-xs font-semibold text-rose-500">
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <LabeledField label="Code">
                                  <input className={fieldClass()} value={entry.code} onChange={(event) => updateNestedEntry(line.id, "equipmentEntries", entry.id, "code", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Description">
                                  <input className={fieldClass()} value={entry.description} onChange={(event) => updateNestedEntry(line.id, "equipmentEntries", entry.id, "description", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Quantity">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.quantity} onChange={(event) => updateNestedEntry(line.id, "equipmentEntries", entry.id, "quantity", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Rental Days">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.rentalDays} onChange={(event) => updateNestedEntry(line.id, "equipmentEntries", entry.id, "rentalDays", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Unit Rate ($)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.unitRate} onChange={(event) => updateNestedEntry(line.id, "equipmentEntries", entry.id, "unitRate", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Freight ($)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.freight} onChange={(event) => updateNestedEntry(line.id, "equipmentEntries", entry.id, "freight", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Fuel (%)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.fuelPercent} onChange={(event) => updateNestedEntry(line.id, "equipmentEntries", entry.id, "fuelPercent", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Tax (%)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.taxPercent} onChange={(event) => updateNestedEntry(line.id, "equipmentEntries", entry.id, "taxPercent", event.target.value)} />
                                </LabeledField>
                              </div>
                              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Cost</div><div className="mt-1 font-bold">{formatCurrency(cost)}</div></div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Cost w/ Freight</div><div className="mt-1 font-bold">{formatCurrency(costWithFreight)}</div></div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Cost w/ Fuel</div><div className="mt-1 font-bold">{formatCurrency(costWithFuel)}</div></div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Cost w/ Tax</div><div className="mt-1 font-bold">{formatCurrency(costWithTax)}</div></div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Total</div><div className="mt-1 font-bold">{formatCurrency(total)}</div></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button type="button" onClick={() => addNestedEntry(line.id, "equipmentEntries", createEquipmentEntry)} className="acm-btn acm-btn-secondary h-10 px-4">
                        Add Other Equipment
                      </button>
                    </LineSection>

                    <LineSection title="Overhead" subtitle="Direct overhead with quantity, days, tax, and total">
                      <div className="space-y-4">
                        {line.overheadEntries.map((entry, index) => {
                          const quantity = toNumber(entry.quantity);
                          const unitRate = toNumber(entry.unitRate);
                          const days = toNumber(entry.days);
                          const taxPercent = toNumber(entry.taxPercent);
                          const cost = quantity * unitRate * days;
                          const costWithTax = cost * toPercent(taxPercent);
                          const total = cost + costWithTax;
                          return (
                            <div key={entry.id} className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Overhead Line {index + 1}</div>
                                {line.overheadEntries.length > 1 ? (
                                  <button type="button" onClick={() => removeNestedEntry(line.id, "overheadEntries", entry.id)} className="text-xs font-semibold text-rose-500">
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <LabeledField label="Code">
                                  <input className={fieldClass()} value={entry.code} onChange={(event) => updateNestedEntry(line.id, "overheadEntries", entry.id, "code", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Description">
                                  <input className={fieldClass()} value={entry.description} onChange={(event) => updateNestedEntry(line.id, "overheadEntries", entry.id, "description", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Quantity">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.quantity} onChange={(event) => updateNestedEntry(line.id, "overheadEntries", entry.id, "quantity", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="UOM">
                                  <input className={fieldClass()} value={entry.uom} onChange={(event) => updateNestedEntry(line.id, "overheadEntries", entry.id, "uom", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Unit Rate ($)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.unitRate} onChange={(event) => updateNestedEntry(line.id, "overheadEntries", entry.id, "unitRate", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Days">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.days} onChange={(event) => updateNestedEntry(line.id, "overheadEntries", entry.id, "days", event.target.value)} />
                                </LabeledField>
                                <LabeledField label="Tax (%)">
                                  <input className={fieldClass()} inputMode="decimal" value={entry.taxPercent} onChange={(event) => updateNestedEntry(line.id, "overheadEntries", entry.id, "taxPercent", event.target.value)} />
                                </LabeledField>
                              </div>
                              <div className="mt-4 grid gap-3 md:grid-cols-3">
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Cost</div><div className="mt-1 font-bold">{formatCurrency(cost)}</div></div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Cost w/ Tax</div><div className="mt-1 font-bold">{formatCurrency(costWithTax)}</div></div>
                                <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm"><div className="font-semibold text-[color:var(--acm-muted-fg)]">Total</div><div className="mt-1 font-bold">{formatCurrency(total)}</div></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button type="button" onClick={() => addNestedEntry(line.id, "overheadEntries", createOverheadEntry)} className="acm-btn acm-btn-secondary h-10 px-4">
                        Add Overhead
                      </button>
                    </LineSection>
                  </div>
                </LineSection>
              ))}
            </div>

            <button type="button" onClick={addCostLine} className="acm-btn acm-btn-secondary h-10 px-4">
              Add Cost Line
            </button>
          </FieldGroup>

          <EstimateSummaryCard summary={previewSummary} />

          <BusyButton type="submit" busy={busy} className="acm-btn acm-btn-primary">
            {form.id ? "Save Estimate" : "Create Estimate"}
          </BusyButton>
        </form>
      </Modal>

      <Modal open={Boolean(selectedEstimate)} title="Estimate Details" onClose={() => setSelectedEstimate(null)}>
        {selectedEstimate ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => exportEstimate(selectedEstimate, "pdf")} className="acm-btn acm-btn-secondary h-10 px-4">
                Download PDF
              </button>
              <button type="button" onClick={() => exportEstimate(selectedEstimate, "csv")} className="acm-btn acm-btn-secondary h-10 px-4">
                Export CSV
              </button>
              {canManage ? (
                <>
                  <button type="button" onClick={() => openEdit(selectedEstimate)} className="acm-btn acm-btn-secondary h-10 px-4">
                    Edit Estimate
                  </button>
                  <button type="button" onClick={() => deleteEstimate(selectedEstimate)} className="acm-btn acm-btn-secondary h-10 px-4">
                    Delete Estimate
                  </button>
                </>
              ) : null}
            </div>

            <div className="space-y-2">
              <DetailRow label="Estimate" value={`${buildEstimateTitle(selectedEstimate)} | ${selectedEstimate.title || "-"}`} />
              <DetailRow label="Date" value={formatDate(selectedEstimate.estimate_date)} />
              <DetailRow label="Status" value={selectedEstimate.status || "-"} />
              <DetailRow label="Prepared By" value={selectedEstimate.prepared_by?.name || selectedEstimate.prepared_by?.user_name || selectedEstimate.prepared_by?.user_code || "-"} />
              <DetailRow label="Notes" value={selectedEstimate.notes || "-"} />
            </div>

            {(selectedEstimate.cost_codes ?? []).map((line, index) => (
              <div key={line.id || `${line.costCode?.code}-${index}`} className="rounded-[18px] border border-[color:var(--acm-border)] p-4">
                <div className="text-sm font-bold text-[color:var(--acm-fg)]">{line.costCode?.name || `Cost Line ${index + 1}`}</div>
                <div className="mt-1 text-xs text-[color:var(--acm-muted-fg)]">{line.costCode?.code || "-"} | {line.costCode?.description || "-"}</div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm">
                  <div>Labor: {formatCurrency(line.laborCost)}</div>
                  <div>Material: {formatCurrency(line.materialCost)}</div>
                  <div>Equipment: {formatCurrency(line.equipmentCost)}</div>
                  <div>Overhead: {formatCurrency(line.directOverhead)}</div>
                </div>
              </div>
            ))}

            <EstimateSummaryCard summary={selectedEstimate.summary || previewSummary} />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
