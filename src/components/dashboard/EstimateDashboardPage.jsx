"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { BusyButton, CompactListRow } from "@/components/dashboard/DashboardUi";
import { ChevronRightIcon } from "@/components/dashboard/icons";
import { invalidateApiQuery, useApiQuery } from "@/lib/client/apiQuery";

const BRAND_PALETTES = {
  accentColor: ["#1e3a8a", "#0f766e", "#b45309", "#7c2d12", "#334155", "#0f766e"],
  canvasTint: ["#f5f7fb", "#f7faf9", "#fff8f1", "#fff7ed", "#f8fafc", "#f0fdfa"],
  surfaceTint: ["#ffffff", "#fefefe", "#fffbf5", "#fffaf0", "#f8fafc", "#ecfeff"],
  textColor: ["#0f172a", "#052e2b", "#111827", "#3b1d12", "#1e293b", "#164e63"],
};

function cardClass(extra = "") {
  return `rounded-[28px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] shadow-[0_22px_60px_rgba(15,23,42,0.08)] ${extra}`.trim();
}

function inputClass(extra = "") {
  return `acm-input mt-0 rounded-[16px] px-3 py-2.5 text-sm ${extra}`.trim();
}

function statusTone(status) {
  switch (status) {
    case "approved":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
    case "sent":
      return "border-sky-500/25 bg-sky-500/10 text-sky-700";
    case "rejected":
      return "border-rose-500/25 bg-rose-500/10 text-rose-700";
    default:
      return "border-amber-500/25 bg-amber-500/10 text-amber-700";
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPercent(value) {
  const parsed = toNumber(value);
  return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatApiError(json, fallback) {
  if (json?.detail === "cost_code_required" || json?.error === "cost_code_required") {
    return "Each section now auto-generates a cost code. If the error persists, fill the section code field.";
  }
  if (json?.detail?.fieldErrors) {
    const fieldMessages = Object.values(json.detail.fieldErrors).flat().filter(Boolean);
    if (fieldMessages.length) return fieldMessages[0];
  }
  if (typeof json?.detail === "string" && json.detail.trim()) return json.detail;
  if (typeof json?.error === "string" && json.error.trim()) return json.error;
  return fallback;
}

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function companyInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "ACM";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function createRate() {
  return { id: createId("rate"), name: "", value: "" };
}

function createTemplateRate(index = 1) {
  return { id: `template-rate-${index}`, name: "", value: "" };
}

function createLaborEntry() {
  return {
    id: createId("labor"),
    title: "",
    classification: "",
    baseWage: "",
    rates: [createRate()],
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
    taxPercent: "",
  };
}

function createMaterialEntry() {
  return {
    id: createId("material"),
    code: "",
    description: "",
    quantity: "",
    uom: "",
    unitRate: "",
    wastePercent: "",
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
    code: `SEC-${String(index).padStart(3, "0")}`,
    description: "",
    laborEntries: [createLaborEntry()],
    materialEntries: [createMaterialEntry()],
    equipmentEntries: [createEquipmentEntry()],
    overheadEntries: [createOverheadEntry()],
  };
}

function defaultTemplateConfiguration() {
  return {
    sections: {
      basicDetails: { enabled: true, label: "Basic Details" },
      labor: { enabled: true, label: "Labor" },
      material: { enabled: true, label: "Material" },
      equipment: { enabled: true, label: "Equipment" },
      overhead: { enabled: true, label: "Overhead" },
    },
    fields: {
      basicDetails: {
        title: true,
        estimateDate: true,
        validUntil: true,
        client: true,
        customerEmail: true,
        customerPhone: true,
        customerAddress: true,
        template: true,
        notes: true,
        terms: true,
        signature: true,
        stamp: true,
      },
    },
    laborLibrary: {
      classifications: ["Journeyman", "Foreman", "Apprentice"],
      rateDefaults: [
        { name: "FICA", value: "7.65" },
        { name: "SUI", value: "3.2" },
      ],
    },
    branding: {
      templateHeader: "Estimate",
      templateSubheader: "Prepared for client review",
      badgeLabel: "Standard",
      accentColor: "#1e3a8a",
      canvasTint: "#f5f7fb",
      surfaceTint: "#ffffff",
      textColor: "#0f172a",
      logoUrl: "/assets/logo.png",
      showLogo: true,
    },
  };
}

function normalizeTemplateConfiguration(configuration) {
  const defaults = defaultTemplateConfiguration();
  const raw = configuration && typeof configuration === "object" ? configuration : {};

  return {
    sections: {
      basicDetails: { ...defaults.sections.basicDetails, ...(raw.sections?.basicDetails || {}) },
      labor: { ...defaults.sections.labor, ...(raw.sections?.labor || {}) },
      material: { ...defaults.sections.material, ...(raw.sections?.material || {}) },
      equipment: { ...defaults.sections.equipment, ...(raw.sections?.equipment || {}) },
      overhead: { ...defaults.sections.overhead, ...(raw.sections?.overhead || {}) },
    },
    fields: {
      basicDetails: {
        ...defaults.fields.basicDetails,
        ...(raw.fields?.basicDetails && typeof raw.fields.basicDetails === "object" ? raw.fields.basicDetails : {}),
      },
    },
    laborLibrary: {
      classifications: Array.isArray(raw.laborLibrary?.classifications)
        ? raw.laborLibrary.classifications.map((item) => String(item || "").trim()).filter(Boolean)
        : defaults.laborLibrary.classifications,
      rateDefaults: Array.isArray(raw.laborLibrary?.rateDefaults)
        ? raw.laborLibrary.rateDefaults.map((item, index) => ({
            id: item?.id || `template-rate-${index + 1}`,
            name: String(item?.name || "").trim(),
            value: String(item?.value ?? "").trim(),
          }))
        : defaults.laborLibrary.rateDefaults.map((item, index) => ({ id: `template-rate-${index + 1}`, ...item })),
    },
    branding: {
      ...defaults.branding,
      ...(raw.branding && typeof raw.branding === "object" ? raw.branding : {}),
    },
  };
}

function emptyTemplateForm() {
  return {
    id: "",
    name: "Company Estimate Template",
    isDefault: false,
    templateKind: "company_custom",
    configuration: defaultTemplateConfiguration(),
  };
}

function emptyEstimateForm(clientId = "", templateId = "") {
  const today = new Date().toISOString().slice(0, 10);
  const valid = new Date();
  valid.setDate(valid.getDate() + 30);

  return {
    id: "",
    clientId,
    templateId,
    title: "Estimate",
    estimateDate: today,
    validUntil: valid.toISOString().slice(0, 10),
    status: "draft",
    approvalStatus: "draft",
    invoiceStatus: "not_started",
    notes: "",
    terms: "",
    customerName: "",
    customerAddress: "",
    customerEmail: "",
    customerPhone: "",
    companyName: "",
    companyAddress: "",
    companyEmail: "",
    companyPhone: "",
    companyLogoText: "ACM",
    overheadPercent: "10",
    profitPercent: "10",
    commissionPercent: "0",
    riskPercent: "0",
    inflationRate: "0",
    escalationYears: "0",
    discountType: "percent",
    discountValue: "0",
    shippingCharge: "0",
    additionalCharges: "0",
    signatureLabel: "Accepted By",
    costLines: [createCostLine(1)],
  };
}

function calculateLabor(entry) {
  const ratePercent = (entry.rates ?? []).reduce((sum, rate) => sum + toNumber(rate.value), 0);
  const baseWage = toNumber(entry.baseWage);
  const stRate = toNumber(entry.stRate) || baseWage * (1 + ratePercent / 100);
  const otRate = toNumber(entry.otRate) || stRate * 1.5;
  const totalAmount = toNumber(entry.stHours) * stRate + toNumber(entry.otHours) * otRate;

  return {
    stRate,
    otRate,
    total: totalAmount,
    taxAmount: totalAmount * toPercent(entry.taxPercent),
  };
}

function calculateMaterial(entry) {
  const quantity = toNumber(entry.quantity);
  const cost = quantity * toNumber(entry.unitRate);
  const freight = toNumber(entry.freight);
  const subtotal = cost + freight;
  const taxAmount = subtotal * toPercent(entry.taxPercent);
  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
  };
}

function calculateEquipment(entry) {
  const cost = toNumber(entry.quantity) * Math.max(toNumber(entry.rentalDays), 1) * toNumber(entry.unitRate);
  const freight = toNumber(entry.freight);
  const fuel = (cost + freight) * toPercent(entry.fuelPercent);
  const subtotal = cost + freight + fuel;
  const taxAmount = subtotal * toPercent(entry.taxPercent);
  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
  };
}

function calculateOverhead(entry) {
  const cost = toNumber(entry.quantity) * Math.max(toNumber(entry.days), 1) * toNumber(entry.unitRate);
  const taxAmount = cost * toPercent(entry.taxPercent);
  return {
    subtotal: cost,
    taxAmount,
    total: cost + taxAmount,
  };
}

function computeUiTotals(form, previewSummary) {
  const taxAmount = form.costLines.reduce((sum, line) => {
    const laborTax = (line.laborEntries ?? []).reduce((acc, entry) => acc + calculateLabor(entry).taxAmount, 0);
    const materialTax = (line.materialEntries ?? []).reduce((acc, entry) => acc + calculateMaterial(entry).taxAmount, 0);
    const equipmentTax = (line.equipmentEntries ?? []).reduce((acc, entry) => acc + calculateEquipment(entry).taxAmount, 0);
    const overheadTax = (line.overheadEntries ?? []).reduce((acc, entry) => acc + calculateOverhead(entry).taxAmount, 0);
    return sum + laborTax + materialTax + equipmentTax + overheadTax;
  }, 0);

  const subtotal = toNumber(previewSummary.finalBid || previewSummary.totalPrice || previewSummary.baseCost);
  const discountAmount = form.discountType === "fixed" ? toNumber(form.discountValue) : subtotal * toPercent(form.discountValue);
  const additionalCharges = toNumber(form.shippingCharge) + toNumber(form.additionalCharges);
  const grandTotal = subtotal - discountAmount + additionalCharges;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    additionalCharges,
    grandTotal,
  };
}

function computeCostLineSummary(line) {
  const laborCost = (line.laborEntries ?? []).reduce((sum, entry) => sum + calculateLabor(entry).total, 0);
  const materialCost = (line.materialEntries ?? []).reduce((sum, entry) => sum + calculateMaterial(entry).total, 0);
  const equipmentCost = (line.equipmentEntries ?? []).reduce((sum, entry) => sum + calculateEquipment(entry).total, 0);
  const overheadCost = (line.overheadEntries ?? []).reduce((sum, entry) => sum + calculateOverhead(entry).total, 0);
  const total = laborCost + materialCost + equipmentCost + overheadCost;

  return {
    laborCost,
    materialCost,
    equipmentCost,
    overheadCost,
    total,
    laborCount: (line.laborEntries ?? []).length,
    materialCount: (line.materialEntries ?? []).length,
    equipmentCount: (line.equipmentEntries ?? []).length,
    overheadCount: (line.overheadEntries ?? []).length,
  };
}

function buildClientPreviewSummary(form) {
  const lineSummaries = (form.costLines ?? []).map(computeCostLineSummary);
  const baseCost = lineSummaries.reduce((sum, line) => sum + line.total, 0);
  const overheadPercent = toPercent(form.overheadPercent);
  const profitPercent = toPercent(form.profitPercent);
  const commissionPercent = toPercent(form.commissionPercent);
  const riskPercent = toPercent(form.riskPercent);
  const inflationRate = toPercent(form.inflationRate);
  const escalationYears = toNumber(form.escalationYears);
  const overheadAmount = baseCost * overheadPercent;
  const profitAmount = (baseCost + overheadAmount) * profitPercent;
  const commissionAmount = (baseCost + overheadAmount + profitAmount) * commissionPercent;
  const contingencyAmount = (baseCost + overheadAmount + profitAmount + commissionAmount) * riskPercent;
  const totalPrice = baseCost + overheadAmount + profitAmount + commissionAmount + contingencyAmount;
  const futureCost = totalPrice * inflationRate * Math.max(escalationYears, 0);

  return {
    laborCost: lineSummaries.reduce((sum, line) => sum + line.laborCost, 0),
    materialCost: lineSummaries.reduce((sum, line) => sum + line.materialCost, 0),
    equipmentCost: lineSummaries.reduce((sum, line) => sum + line.equipmentCost, 0),
    directOverheadCost: lineSummaries.reduce((sum, line) => sum + line.overheadCost, 0),
    baseCost,
    totalCost: baseCost,
    overheadPercent,
    overheadAmount,
    profitPercent,
    profitAmount,
    commissionPercent,
    commissionAmount,
    riskPercent,
    contingencyAmount,
    inflationRate,
    escalationYears,
    futureCost,
    totalPrice,
    finalBid: totalPrice + futureCost,
  };
}

function buildPayload(form, selectedTemplate, previewSummary, companyDetails) {
  const totals = computeUiTotals(form, previewSummary);

  return {
    id: form.id || undefined,
    clientId: form.clientId,
    templateId: form.templateId || selectedTemplate?.id || undefined,
    title: form.title,
    estimateDate: form.estimateDate,
    status: form.status,
    approvalStatus: form.approvalStatus,
    invoiceStatus: form.invoiceStatus,
    notes: form.notes,
    overheadPercent: form.overheadPercent,
    profitPercent: form.profitPercent,
    commissionPercent: form.commissionPercent,
    riskPercent: form.riskPercent,
    inflationRate: form.inflationRate,
    escalationYears: form.escalationYears,
    documentMeta: {
      validUntil: form.validUntil,
      customer: {
        name: form.customerName,
        address: form.customerAddress,
        email: form.customerEmail,
        phone: form.customerPhone,
      },
      company: {
        name: companyDetails.name,
        address: companyDetails.address,
        contactEmail: companyDetails.email,
        contactPhone: companyDetails.phone,
        logoText: companyDetails.logoText,
        logoDataUrl: companyDetails.logoDataUrl,
        signatureDataUrl: companyDetails.signatureDataUrl,
        signatureName: companyDetails.signatureName,
        stampDataUrl: companyDetails.stampDataUrl,
        stampLabel: companyDetails.stampLabel,
      },
      branding: selectedTemplate?.configuration?.branding || defaultTemplateConfiguration().branding,
      notes: form.notes,
      terms: form.terms,
      signatureLabel: form.signatureLabel,
      discountType: form.discountType,
      discountValue: form.discountValue,
      shippingCharge: form.shippingCharge,
      additionalCharges: form.additionalCharges,
      totals,
    },
    costCodes: form.costLines.map((line, index) => ({
      code: line.code?.trim() || `SEC-${String(index + 1).padStart(3, "0")}`,
      name: line.description?.trim() || `Section ${index + 1}`,
      description: line.description?.trim() || `Section ${index + 1}`,
      laborEntries: line.laborEntries.map((entry) => {
        const derived = calculateLabor(entry);
        return {
          description: entry.title,
          stHours: entry.stHours,
          stRate: derived.stRate,
          otHours: entry.otHours,
          otRate: derived.otRate,
          metadata: {
            title: entry.title,
            classification: entry.classification,
            baseWage: toNumber(entry.baseWage),
            rates: entry.rates,
            straightTimePersons: toNumber(entry.straightTimePersons),
            straightTimeDays: toNumber(entry.straightTimeDays),
            overtimePersons: toNumber(entry.overtimePersons),
            overtimeDays: toNumber(entry.overtimeDays),
            targetWage: toNumber(entry.targetWage),
            prevailWage: toNumber(entry.prevailWage),
            taxPercent: toNumber(entry.taxPercent),
          },
        };
      }),
      materialEntries: line.materialEntries.map((entry) => ({
        description: entry.description,
        quantity: entry.quantity,
        wastePercent: entry.wastePercent,
        unitRate: entry.unitRate,
        freight: entry.freight,
        taxPercent: entry.taxPercent,
        metadata: {
          code: entry.code?.trim() || undefined,
          uom: entry.uom,
        },
      })),
      equipmentEntries: line.equipmentEntries.map((entry) => ({
        description: entry.description,
        qty: entry.quantity,
        days: entry.rentalDays,
        rate: entry.unitRate,
        freight: entry.freight,
        fuel: (toNumber(entry.quantity) * Math.max(toNumber(entry.rentalDays), 1) * toNumber(entry.unitRate) + toNumber(entry.freight)) * toPercent(entry.fuelPercent),
        taxPercent: entry.taxPercent,
        metadata: {
          code: entry.code?.trim() || undefined,
          fuelPercent: toNumber(entry.fuelPercent),
        },
      })),
      overheadEntries: line.overheadEntries.map((entry) => ({
        description: entry.description,
        qty: entry.quantity,
        days: entry.days,
        rate: entry.unitRate,
        taxPercent: entry.taxPercent,
        metadata: {
          code: entry.code?.trim() || undefined,
          uom: entry.uom,
        },
      })),
    })),
  };
}

function mapEstimateToForm(estimate, templates) {
  const meta = estimate?.summary?.documentMeta || {};
  const customer = meta.customer || {};
  const company = meta.company || {};
  const templateId = estimate.template_id || "";
  const today = new Date().toISOString().slice(0, 10);

  return {
    ...emptyEstimateForm(estimate.client_id || "", templateId),
    id: estimate.id,
    clientId: estimate.client_id || "",
    templateId,
    title: estimate.title || "Estimate",
    estimateDate: estimate.estimate_date || today,
    validUntil: meta.validUntil || today,
    status: estimate.status || "draft",
    approvalStatus: estimate.approval_status || "draft",
    invoiceStatus: estimate.invoice_status || "not_started",
    notes: meta.notes || estimate.notes || "",
    terms: meta.terms || "",
    customerName: customer.name || estimate.client?.name || "",
    customerAddress: customer.address || estimate.client?.address || "",
    customerEmail: customer.email || estimate.client?.email || "",
    customerPhone: customer.phone || estimate.client?.contact || "",
    companyName: company.name || "",
    companyAddress: company.address || "",
    companyEmail: company.contactEmail || "",
    companyPhone: company.contactPhone || "",
    companyLogoText: company.logoText || "ACM",
    discountType: meta.discountType || "percent",
    discountValue: String(meta.discountValue || 0),
    shippingCharge: String(meta.shippingCharge || 0),
    additionalCharges: String(meta.additionalCharges || 0),
    signatureLabel: meta.signatureLabel || "Accepted By",
    overheadPercent: String(toNumber(estimate.summary?.overheadPercent) * 100 || 10),
    profitPercent: String(toNumber(estimate.summary?.profitPercent) * 100 || 10),
    commissionPercent: String(toNumber(estimate.summary?.commissionPercent) * 100 || 0),
    riskPercent: String(toNumber(estimate.summary?.riskPercent) * 100 || 0),
    inflationRate: String(toNumber(estimate.summary?.inflationRate) * 100 || 0),
    escalationYears: String(toNumber(estimate.summary?.escalationYears) || 0),
    costLines:
      (estimate.cost_codes ?? []).length
        ? estimate.cost_codes.map((line, index) => ({
            id: line.id || createId("cost-line"),
            code: line.costCode?.code || `SEC-${String(index + 1).padStart(3, "0")}`,
            description: line.costCode?.description || "",
            laborEntries:
              (line.laborEntries ?? []).length
                ? line.laborEntries.map((entry) => ({
                    id: entry.id || createId("labor"),
                    title: entry.metadata?.title || entry.description || "",
                    classification: entry.metadata?.classification || "",
                    baseWage: entry.metadata?.baseWage ?? "",
                    rates: (entry.metadata?.rates ?? []).length ? entry.metadata.rates : [createRate()],
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
                    taxPercent: entry.metadata?.taxPercent ?? "",
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
                    unitRate: entry.unitRate ?? "",
                    wastePercent: toNumber(entry.wastePercent) * 100,
                    freight: entry.freight ?? "",
                    taxPercent: toNumber(entry.taxPercent) * 100,
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
                    taxPercent: toNumber(entry.taxPercent) * 100,
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
                    taxPercent: toNumber(entry.taxPercent) * 100,
                  }))
                : [createOverheadEntry()],
          }))
        : [createCostLine(1)],
  };
}

function LabeledInput({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value, tone = "default", note }) {
  const toneClass =
    tone === "accent"
      ? "border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] text-[color:var(--acm-accent-strong)]"
      : "border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] text-[color:var(--acm-fg)]";

  return (
    <div className={`rounded-[20px] border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-2 text-xl font-bold tracking-tight">{value}</div>
      {note ? <div className="mt-1 text-xs opacity-70">{note}</div> : null}
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusTone(status)}`}>
      {String(status || "draft").replaceAll("_", " ")}
    </span>
  );
}

function ColorPaletteInput({ label, value, onChange, options }) {
  return (
    <div className="grid gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.toLowerCase() === String(value).toLowerCase();
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`h-8 w-8 rounded-full border-2 transition ${active ? "scale-110 border-slate-900" : "border-white/70"}`}
              style={{ backgroundColor: option }}
              aria-label={`${label} ${option}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function EstimatePreviewCard({ form, selectedTemplate, totals }) {
  const branding = selectedTemplate?.configuration?.branding || defaultTemplateConfiguration().branding;
  const palette = {
    background: branding.canvasTint,
    surface: branding.surfaceTint,
    accent: branding.accentColor,
    text: branding.textColor,
  };

  return (
    <div className="rounded-[30px] border border-black/5 p-5 shadow-[0_24px_64px_rgba(15,23,42,0.12)]" style={{ background: palette.background, color: palette.text }}>
      <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
        <div className="flex items-center gap-4">
          {form.companyLogoUrl ? (
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] bg-white">
              <img src={form.companyLogoUrl} alt="Company logo" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] font-extrabold text-white" style={{ background: palette.accent }}>
              {form.companyLogoText || "ACM"}
            </div>
          )}
          <div>
            <div className="text-lg font-bold">{form.companyName || "Your Company"}</div>
            <div className="text-sm opacity-70">{form.companyAddress || "Company address"}</div>
          </div>
        </div>
        <div className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: palette.accent }}>
          {branding.badgeLabel || "Estimate"}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[20px] border border-black/8 p-4" style={{ background: palette.surface }}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-65">Client</div>
          <div className="mt-2 text-base font-bold">{form.customerName || "Customer name"}</div>
          <div className="mt-1 text-sm opacity-70">{form.customerAddress || "Customer address"}</div>
        </div>
        <div className="rounded-[20px] border border-black/8 p-4" style={{ background: palette.surface }}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-65">{form.title || "Estimate"}</div>
          <div className="mt-2 flex items-center justify-between text-sm"><span>Total</span><strong>{formatCurrency(totals.grandTotal)}</strong></div>
          <div className="mt-1 flex items-center justify-between text-sm opacity-70"><span>Valid Until</span><span>{formatDate(form.validUntil)}</span></div>
        </div>
      </div>
    </div>
  );
}

function FormulaCard({ label, value, note, tone = "default" }) {
  return <MetricCard label={label} value={value} tone={tone} note={note} />;
}

function StatusButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-full px-4 text-sm font-semibold transition ${
        active
          ? "bg-[color:var(--acm-accent)] text-white shadow-[0_12px_30px_rgba(30,58,138,0.25)]"
          : "border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] text-[color:var(--acm-fg)]"
      }`}
    >
      {children}
    </button>
  );
}

function TableCellInput({ value, onChange, onKeyDown, list, placeholder = "", type = "text" }) {
  return (
    <input
      type={type}
      list={list}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      data-grid-input="true"
      className={inputClass("min-w-[84px] border-transparent bg-transparent px-2 py-2 text-sm focus:border-[color:var(--acm-accent-border)]")}
    />
  );
}

function SectionTable({
  title,
  sectionKey,
  rows,
  columns,
  onChange,
  onAdd,
  onRemove,
  onKeyDown,
  datalistId,
  datalistOptions,
  collapsed,
  onToggle,
}) {
  const derivedRows = rows.map((row) =>
    sectionKey === "laborEntries"
      ? calculateLabor(row)
      : sectionKey === "materialEntries"
        ? calculateMaterial(row)
        : sectionKey === "equipmentEntries"
          ? calculateEquipment(row)
          : calculateOverhead(row)
  );
  const sectionSubtotal = derivedRows.reduce((sum, row) => sum + row.total, 0);
  const sectionTax = derivedRows.reduce((sum, row) => sum + row.taxAmount, 0);

  return (
    <div className="rounded-[24px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
        <div>
          <div className="text-base font-bold text-[color:var(--acm-fg)]">{title}</div>
          <div className="text-sm text-[color:var(--acm-muted-fg)]">{rows.length} inline row{rows.length === 1 ? "" : "s"}</div>
        </div>
        <ChevronRightIcon className={`h-5 w-5 transition ${collapsed ? "" : "rotate-90"}`} />
      </button>

      {!collapsed ? (
        <div className="border-t border-[color:var(--acm-border)] p-3">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
                  {columns.map((column) => (
                    <th key={column.key} className="px-2 py-2 font-semibold">{column.label}</th>
                  ))}
                  <th className="px-2 py-2 font-semibold">Amount</th>
                  <th className="px-2 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody data-grid-scope={sectionKey}>
                {rows.map((row, index) => {
                  const derived = derivedRows[index];
                  return (
                    <tr key={row.id} className="border-t border-[color:var(--acm-border)] align-top">
                      {columns.map((column) => (
                        <td key={column.key} className="px-1 py-1">
                          <TableCellInput
                            value={row[column.key]}
                            list={column.list ? datalistId : undefined}
                            type={column.type || "text"}
                            placeholder={column.placeholder}
                            onChange={(event) => onChange(row.id, column.key, event.target.value)}
                            onKeyDown={onKeyDown}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-3 text-sm font-semibold text-[color:var(--acm-fg)]">{formatCurrency(derived.total)}</td>
                      <td className="px-2 py-2 text-right">
                        {rows.length > 1 ? (
                          <button type="button" onClick={() => onRemove(row.id)} className="rounded-full px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                            Remove
                          </button>
                        ) : (
                          <span className="px-3 py-1 text-xs text-[color:var(--acm-muted-fg)]">{index + 1}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MetricCard label={`${title} Total`} value={formatCurrency(sectionSubtotal)} />
            <MetricCard label="Tax" value={formatCurrency(sectionTax)} />
            <MetricCard label="Net Before Tax" value={formatCurrency(sectionSubtotal - sectionTax)} tone="accent" />
          </div>

          {datalistId && datalistOptions?.length ? (
            <datalist id={datalistId}>
              {datalistOptions.map((option) => (
                <option key={option.label} value={option.label} />
              ))}
            </datalist>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onAdd} className="acm-btn acm-btn-secondary h-10 rounded-full px-4">
              Add {title.slice(0, -1) || title}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EstimateDashboardPage({ roleBase = "owner", initialEstimateId = "", initialCostLineId = "" }) {
  const router = useRouter();
  const clientsQuery = useApiQuery("/api/clients");
  const settingsQuery = useApiQuery("/api/settings");
  const templatesQuery = useApiQuery("/api/estimate-templates");
  const estimatesQuery = useApiQuery("/api/estimates");

  const [tab, setTab] = useState("estimates");
  const [busy, setBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(() => emptyEstimateForm());
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [activeEstimateId, setActiveEstimateId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pdfReviewed, setPdfReviewed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [selectedCostLineId, setSelectedCostLineId] = useState(initialCostLineId);
  const saveTimeoutRef = useRef(null);
  const persistEstimateRef = useRef(null);
  const initialDetailHydratedRef = useRef(false);

  const clients = useMemo(() => clientsQuery.data?.clients ?? [], [clientsQuery.data?.clients]);
  const profile = useMemo(() => settingsQuery.data?.profile ?? null, [settingsQuery.data?.profile]);
  const templates = useMemo(
    () => (templatesQuery.data?.templates ?? []).map((template) => ({ ...template, configuration: normalizeTemplateConfiguration(template.configuration) })),
    [templatesQuery.data?.templates]
  );
  const estimates = useMemo(() => estimatesQuery.data?.estimates ?? [], [estimatesQuery.data?.estimates]);

  const defaultTemplate = useMemo(() => templates.find((item) => item.is_default) || templates[0] || null, [templates]);
  const companyDetails = useMemo(() => {
    const company = settingsQuery.data?.company || null;
    const metadata = company?.metadata && typeof company.metadata === "object" ? company.metadata : {};
    const name = company?.name || "Your Company";
    return {
      name,
      address: company?.address || profile?.address || "",
      email: company?.email || profile?.email || "",
      phone: company?.contact || profile?.mobile || "",
      logoText: companyInitials(name),
      logoDataUrl: company?.logoDataUrl || metadata.logoDataUrl || "",
      signatureDataUrl: company?.signatureDataUrl || metadata.signatureDataUrl || "",
      signatureName: company?.signatureName || metadata.signatureName || profile?.name || "",
      stampDataUrl: company?.stampDataUrl || metadata.stampDataUrl || "",
      stampLabel: company?.stampLabel || metadata.stampLabel || name,
    };
  }, [profile?.address, profile?.email, profile?.mobile, profile?.name, settingsQuery.data?.company]);
  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === form.templateId) || defaultTemplate,
    [defaultTemplate, form.templateId, templates]
  );
  const previewSummary = useMemo(() => buildClientPreviewSummary(form), [form]);
  const payload = useMemo(() => buildPayload(form, selectedTemplate, previewSummary, companyDetails), [companyDetails, form, previewSummary, selectedTemplate]);
  const uiTotals = useMemo(() => computeUiTotals(form, previewSummary), [form, previewSummary]);
  const detailMode = Boolean(initialEstimateId && selectedCostLineId);
  const activeLineIndex = useMemo(() => form.costLines.findIndex((line) => line.id === selectedCostLineId), [form.costLines, selectedCostLineId]);
  const activeCostLine = activeLineIndex >= 0 ? form.costLines[activeLineIndex] : null;
  const canAutoPersist = useMemo(() => {
    return Boolean(
      form.clientId &&
        form.title.trim() &&
        form.estimateDate &&
        form.validUntil &&
        form.customerName.trim() &&
        form.customerAddress.trim() &&
        isValidEmail(form.customerEmail) &&
        form.customerPhone.trim() &&
        companyDetails.name.trim() &&
        companyDetails.address.trim() &&
        isValidEmail(companyDetails.email) &&
        companyDetails.phone.trim() &&
        selectedTemplate?.id
    );
  }, [
    companyDetails.address,
    companyDetails.email,
    companyDetails.name,
    companyDetails.phone,
    form.clientId,
    form.customerAddress,
    form.customerEmail,
    form.customerName,
    form.customerPhone,
    form.estimateDate,
    form.title,
    form.validUntil,
    selectedTemplate?.id,
  ]);
  const templateBranding = useMemo(
    () => normalizeTemplateConfiguration(templateForm.configuration).branding,
    [templateForm.configuration]
  );
  const selectedTemplateConfig = useMemo(
    () => normalizeTemplateConfiguration(selectedTemplate?.configuration),
    [selectedTemplate?.configuration]
  );
  const laborClassificationOptions = useMemo(
    () => selectedTemplateConfig.laborLibrary?.classifications || [],
    [selectedTemplateConfig]
  );
  const laborRateDefaultOptions = useMemo(
    () => selectedTemplateConfig.laborLibrary?.rateDefaults || [],
    [selectedTemplateConfig]
  );

  const suggestionLibrary = useMemo(() => {
    const labor = new Map();
    const material = new Map();
    const equipment = new Map();
    const overhead = new Map();

    estimates.forEach((estimate) => {
      (estimate.cost_codes ?? []).forEach((line) => {
        (line.laborEntries ?? []).forEach((entry) => {
          const label = entry.metadata?.title || entry.description;
          if (!label || labor.has(label)) return;
          labor.set(label, {
            label,
            classification: entry.metadata?.classification || "",
            baseWage: entry.metadata?.baseWage || "",
            stRate: entry.stRate || "",
          });
        });
        (line.materialEntries ?? []).forEach((entry) => {
          const label = entry.description || entry.metadata?.code;
          if (!label || material.has(label)) return;
          material.set(label, {
            label,
            code: entry.metadata?.code || "",
            unitRate: entry.unitRate || "",
            uom: entry.metadata?.uom || "",
            taxPercent: toNumber(entry.taxPercent) * 100,
          });
        });
        (line.equipmentEntries ?? []).forEach((entry) => {
          const label = entry.description || entry.metadata?.code;
          if (!label || equipment.has(label)) return;
          equipment.set(label, {
            label,
            code: entry.metadata?.code || "",
            unitRate: entry.rate || "",
            taxPercent: toNumber(entry.taxPercent) * 100,
            fuelPercent: entry.metadata?.fuelPercent || "",
          });
        });
        (line.overheadEntries ?? []).forEach((entry) => {
          const label = entry.description || entry.metadata?.code;
          if (!label || overhead.has(label)) return;
          overhead.set(label, {
            label,
            code: entry.metadata?.code || "",
            unitRate: entry.rate || "",
            uom: entry.metadata?.uom || "",
            taxPercent: toNumber(entry.taxPercent) * 100,
          });
        });
      });
    });

    return {
      labor: [...labor.values()],
      material: [...material.values()],
      equipment: [...equipment.values()],
      overhead: [...overhead.values()],
    };
  }, [estimates]);

  useEffect(() => {
    if (!initialEstimateId || initialDetailHydratedRef.current || !estimates.length) return;
    const estimate = estimates.find((item) => item.id === initialEstimateId);
    if (!estimate) return;
    setForm(mapEstimateToForm(estimate, templates));
    setActiveEstimateId(estimate.id);
    setSelectedCostLineId(initialCostLineId || estimate.cost_codes?.[0]?.id || "");
    setPdfReviewed(false);
    setDirty(false);
    initialDetailHydratedRef.current = true;
  }, [estimates, initialCostLineId, initialEstimateId, templates]);

  useEffect(() => {
    if (!dirty || !canAutoPersist) return undefined;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistEstimateRef.current?.({ silent: true });
    }, 2500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [canAutoPersist, dirty, payload]);

  function setDirtyState() {
    setDirty(true);
    setPdfReviewed(false);
    setMessage("");
  }

  function updateEstimate(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "clientId") {
        const client = clients.find((item) => item.id === value);
        if (client) {
          next.customerName = current.customerName || client.name || "";
          next.customerAddress = current.customerAddress || client.address || "";
          next.customerEmail = current.customerEmail || client.email || "";
          next.customerPhone = current.customerPhone || client.contact || "";
        }
      }

      if (key === "templateId") {
      }

      return next;
    });
    setDirtyState();
  }

  function updateLine(lineId, key, value) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) => (line.id === lineId ? { ...line, [key]: value } : line)),
    }));
    setDirtyState();
  }

  function applySuggestion(sectionKey, row, value) {
    const mapKey =
      sectionKey === "laborEntries"
        ? "labor"
        : sectionKey === "materialEntries"
          ? "material"
          : sectionKey === "equipmentEntries"
            ? "equipment"
            : "overhead";
    const suggestion = suggestionLibrary[mapKey].find((item) => item.label === value);
    return suggestion ? { ...row, ...suggestion, description: row.description || suggestion.label, title: row.title || suggestion.label } : row;
  }

  function updateEntry(lineId, sectionKey, rowId, key, value) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          [sectionKey]: line[sectionKey].map((row) => {
            if (row.id !== rowId) return row;
            const next = { ...row, [key]: value };
            if (key === "description" || key === "title") {
              return applySuggestion(sectionKey, next, value);
            }
            return next;
          }),
        };
      }),
    }));
    setDirtyState();
  }

  function updateRate(lineId, laborId, rateId, key, value) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          laborEntries: line.laborEntries.map((entry) => {
            if (entry.id !== laborId) return entry;
            return {
              ...entry,
              rates: (entry.rates ?? []).map((rate) => (rate.id === rateId ? { ...rate, [key]: value } : rate)),
            };
          }),
        };
      }),
    }));
    setDirtyState();
  }

  function updateTemplateRate(rateId, key, value) {
    setTemplateForm((current) => {
      const normalized = normalizeTemplateConfiguration(current.configuration);
      return {
        ...current,
        configuration: {
          ...normalized,
          laborLibrary: {
            ...normalized.laborLibrary,
            rateDefaults: normalized.laborLibrary.rateDefaults.map((rate) => (rate.id === rateId ? { ...rate, [key]: value } : rate)),
          },
        },
      };
    });
  }

  function addTemplateRate() {
    setTemplateForm((current) => {
      const normalized = normalizeTemplateConfiguration(current.configuration);
      return {
        ...current,
        configuration: {
          ...normalized,
          laborLibrary: {
            ...normalized.laborLibrary,
            rateDefaults: [...normalized.laborLibrary.rateDefaults, createTemplateRate(normalized.laborLibrary.rateDefaults.length + 1)],
          },
        },
      };
    });
  }

  function removeTemplateRate(rateId) {
    setTemplateForm((current) => {
      const normalized = normalizeTemplateConfiguration(current.configuration);
      const nextRates = normalized.laborLibrary.rateDefaults.filter((rate) => rate.id !== rateId);
      return {
        ...current,
        configuration: {
          ...normalized,
          laborLibrary: {
            ...normalized.laborLibrary,
            rateDefaults: nextRates.length ? nextRates : [createTemplateRate(1)],
          },
        },
      };
    });
  }

  function addRate(lineId, laborId) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          laborEntries: line.laborEntries.map((entry) => (
            entry.id === laborId ? { ...entry, rates: [...(entry.rates ?? []), createRate()] } : entry
          )),
        };
      }),
    }));
    setDirtyState();
  }

  function removeRate(lineId, laborId, rateId) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          laborEntries: line.laborEntries.map((entry) => {
            if (entry.id !== laborId) return entry;
            const nextRates = (entry.rates ?? []).filter((rate) => rate.id !== rateId);
            return { ...entry, rates: nextRates.length ? nextRates : [createRate()] };
          }),
        };
      }),
    }));
    setDirtyState();
  }

  function addEntry(lineId, sectionKey) {
    const createMap = {
      laborEntries: createLaborEntry,
      materialEntries: createMaterialEntry,
      equipmentEntries: createEquipmentEntry,
      overheadEntries: createOverheadEntry,
    };
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) => (
        line.id === lineId ? { ...line, [sectionKey]: [...line[sectionKey], createMap[sectionKey]()] } : line
      )),
    }));
    setDirtyState();
  }

  function removeEntry(lineId, sectionKey, rowId) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          [sectionKey]: line[sectionKey].filter((row) => row.id !== rowId),
        };
      }),
    }));
    setDirtyState();
  }

  function addCostLine() {
    setForm((current) => ({
      ...current,
      costLines: [...current.costLines, createCostLine(current.costLines.length + 1)],
    }));
    setDirtyState();
  }

  function removeCostLine(lineId) {
    setForm((current) => ({
      ...current,
      costLines: current.costLines.length > 1 ? current.costLines.filter((line) => line.id !== lineId) : current.costLines,
    }));
    setDirtyState();
  }

  async function openCostLineDetails(lineId) {
    const targetLine = form.costLines.find((line) => line.id === lineId);
    if (!targetLine) return;

    let estimateId = form.id || activeEstimateId;
    if (!estimateId) {
      const saved = await persistEstimate({ silent: true });
      if (!saved?.id) return;
      estimateId = saved.id;
    }

    setSelectedCostLineId(lineId);
    router.push(`/${roleBase}/estimates/${estimateId}/cost-lines/${lineId}`);
  }

  function closeCostLineDetails() {
    setSelectedCostLineId("");
    router.push(`/${roleBase}/estimates`);
  }

  function toggleSection(lineId, sectionKey) {
    setCollapsedSections((current) => ({
      ...current,
      [`${lineId}:${sectionKey}`]: !current[`${lineId}:${sectionKey}`],
    }));
  }

  function handleGridKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const scope = event.currentTarget.closest("[data-grid-scope]");
    if (!scope) return;
    const inputs = [...scope.querySelectorAll("[data-grid-input='true']")];
    const index = inputs.indexOf(event.currentTarget);
    const next = inputs[index + 1];
    if (next) next.focus();
  }

  async function handleApprove() {
    let createdEstimate = null;
    if (!form.id) {
      createdEstimate = await persistEstimate();
      if (!createdEstimate) return;
    }
    const estimateId = createdEstimate?.id || form.id || activeEstimateId;
    const res = await fetch("/api/estimate-workflow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estimateId, action: "approve" }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(formatApiError(json, "Unable to approve estimate."));
      return;
    }
    invalidateApiQuery("/api/estimates");
    const refreshed = estimates.find((item) => item.id === estimateId);
    if (refreshed) setForm(mapEstimateToForm({ ...refreshed, ...json?.estimate }, templates));
    setMessage("Estimate approved.");
  }

  async function handleSend() {
    if (!pdfReviewed) {
      setError("Open the latest PDF preview before sending.");
      return;
    }
    if (!window.confirm(`Send "${form.title || "Estimate"}" to ${form.customerEmail || "the customer"} using the configured SMTP account?`)) {
      return;
    }

    const saved = await persistEstimate({ silent: true });
    if (!saved) return;

    setSendBusy(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/estimates/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estimateId: saved.id || form.id || activeEstimateId, confirmSend: true }),
    });
    const json = await res.json().catch(() => null);
    setSendBusy(false);

    if (!res.ok) {
      setError(formatApiError(json, "Unable to send estimate."));
      return;
    }

    invalidateApiQuery("/api/estimates");
    await estimatesQuery.refresh();
    setForm((current) => ({ ...current, status: "sent" }));
    setMessage("Estimate sent from the configured SMTP account.");
  }

  async function handleReject() {
    await persistEstimate({ status: "rejected" });
  }

  function newEstimate() {
    setForm(emptyEstimateForm("", defaultTemplate?.id || ""));
    setActiveEstimateId("");
    setSelectedCostLineId("");
    setPdfReviewed(false);
    setDirty(false);
    setError("");
    setMessage("");
  }

  function loadEstimate(estimate) {
    setForm(mapEstimateToForm(estimate, templates));
    setActiveEstimateId(estimate.id);
    setSelectedCostLineId("");
    setPdfReviewed(false);
    setDirty(false);
    setError("");
    setMessage("");
  }

  function duplicateEstimate() {
    if (!form.clientId && !form.costLines.some((line) => line.description?.trim())) {
      setMessage("Add estimate details before duplicating.");
      return;
    }
    setForm((current) => ({
      ...current,
      id: "",
      title: current.title?.trim() ? `${current.title} Copy` : "Estimate Copy",
      status: "draft",
      approvalStatus: "draft",
      estimateDate: new Date().toISOString().slice(0, 10),
    }));
    setActiveEstimateId("");
    setPdfReviewed(false);
    setDirty(true);
    setMessage("Estimate duplicated into a new draft.");
  }

  async function deleteEstimate(id) {
    const estimate = estimates.find((item) => item.id === id);
    if (!estimate || !window.confirm(`Delete "${estimate.title || `Estimate #${estimate.estimate_number}`}"?`)) return;

    const res = await fetch("/api/estimates", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(formatApiError(json, "Unable to delete estimate."));
      return;
    }
    invalidateApiQuery("/api/estimates");
    if (activeEstimateId === id) newEstimate();
    setMessage("Estimate deleted.");
  }

  async function openPdf(mode = "download") {
    setPreviewBusy(true);
    const saved = await persistEstimate({ silent: true });
    if (!saved) {
      setPreviewBusy(false);
      return;
    }
    const estimateId = saved.id || form.id || activeEstimateId;
    if (!estimateId) {
      setPreviewBusy(false);
      return;
    }
    const url = `/api/estimates?id=${estimateId}&export=pdf&disposition=inline`;
    window.open(url, "_blank", "noopener,noreferrer");
    setPreviewBusy(false);
    setPdfReviewed(true);
    setMessage("PDF preview opened.");
  }

  async function saveTemplate(event) {
    event.preventDefault();
    setTemplateBusy(true);
    setError("");
    const templatePayload = {
      name: templateForm.name,
      isDefault: templateForm.isDefault,
      templateKind: templateForm.templateKind,
      configuration: normalizeTemplateConfiguration(templateForm.configuration),
      ...(templateForm.id ? { id: templateForm.id } : {}),
    };
    const res = await fetch("/api/estimate-templates", {
      method: templateForm.id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(templatePayload),
    });
    const json = await res.json().catch(() => null);
    setTemplateBusy(false);
    if (!res.ok) {
      setError(formatApiError(json, "Unable to save template."));
      return;
    }
    invalidateApiQuery("/api/estimate-templates");
    if (json?.template) {
      const savedTemplate = {
        ...json.template,
        configuration: normalizeTemplateConfiguration(json.template.configuration),
      };
      templatesQuery.setData((current) => {
        const currentTemplates = current?.templates ?? [];
        const nextTemplates = currentTemplates.some((template) => template.id === savedTemplate.id)
          ? currentTemplates.map((template) => (template.id === savedTemplate.id ? savedTemplate : template))
          : [...currentTemplates, savedTemplate];
        return { ...(current || {}), templates: nextTemplates };
      });
      openTemplate(savedTemplate);
      if (!form.templateId || templateForm.id === form.templateId || json.template.is_default) {
        setForm((current) => ({ ...current, templateId: savedTemplate.id }));
      }
    }
    setMessage("Template saved.");
  }

  function openTemplate(template) {
    setTemplateForm({
      id: template.id,
      name: template.name,
      isDefault: template.is_default,
      templateKind: template.template_kind || "company_custom",
      configuration: normalizeTemplateConfiguration(template.configuration),
    });
  }

  const validateEstimate = useCallback(() => {
    if (!form.clientId) return "Select a customer.";
    if (!form.title.trim()) return "Title is required.";
    if (!form.customerName.trim()) return "Customer name is required.";
    if (!form.customerAddress.trim()) return "Customer address is required.";
    if (!isValidEmail(form.customerEmail)) return "Enter a valid customer email.";
    if (!form.customerPhone.trim()) return "Customer phone is required.";
    if (!companyDetails.name.trim()) return "Company profile is missing a company name.";
    if (!companyDetails.address.trim()) return "Company profile is missing an address.";
    if (!isValidEmail(companyDetails.email)) return "Company profile is missing a valid email.";
    if (!companyDetails.phone.trim()) return "Company profile is missing a phone number.";
    if (!form.estimateDate) return "Estimate date is required.";
    if (!form.validUntil) return "Valid until date is required.";
    if (new Date(form.validUntil) < new Date(form.estimateDate)) return "Valid until must be on or after the estimate date.";
    if (!selectedTemplate?.id) return "Select a template.";

    const hasRows = form.costLines.some((line) =>
      [...(line.laborEntries ?? []), ...(line.materialEntries ?? []), ...(line.equipmentEntries ?? []), ...(line.overheadEntries ?? [])].some((entry) =>
        Object.entries(entry).some(([key, value]) => {
          if (key === "id" || key === "rates") return false;
          if (typeof value === "string") return value.trim().length > 0;
          return Boolean(value);
        })
      )
    );

    if (!hasRows) return "Add at least one estimate row.";
    return "";
  }, [companyDetails.address, companyDetails.email, companyDetails.name, companyDetails.phone, form, selectedTemplate?.id]);

  const persistEstimate = useCallback(async ({ status, silent = false } = {}) => {
    const validationError = validateEstimate();
    if (validationError) {
      setError(validationError);
      return false;
    }

    const nextPayload = status ? { ...payload, status, approvalStatus: status === "rejected" ? "rejected" : payload.approvalStatus } : payload;
    setBusy(true);
    setError("");
    if (!silent) setMessage("");

    const res = await fetch("/api/estimates", {
      method: form.id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextPayload),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);

    if (!res.ok) {
      setError(formatApiError(json, "Unable to save estimate."));
      return false;
    }

    const saved = json?.estimate;
    if (saved) {
      setForm(mapEstimateToForm(saved, templates));
      setActiveEstimateId(saved.id);
      setDirty(false);
      invalidateApiQuery("/api/estimates");
      if (!silent) setMessage(status === "sent" ? "Estimate marked as sent." : "Estimate saved.");
      return saved;
    }
    return false;
  }, [payload, form.id, templates, validateEstimate]);

  useEffect(() => {
    persistEstimateRef.current = persistEstimate;
  }, [persistEstimate]);

  return (
    <div className="space-y-6">
      <section className={cardClass("p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">Estimate Module</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[color:var(--acm-fg)]">Modern estimate workspace</h1>
            {/* <p className="mt-2 max-w-3xl text-sm text-[color:var(--acm-muted-fg)]">QuickBooks-style document editing, inline line items, dynamic totals, status tracking, duplication, and client-ready export without changing your current backend routes.</p> */}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setTab("estimates")} className={`acm-btn ${tab === "estimates" ? "acm-btn-primary" : "acm-btn-secondary"} h-10 px-4`}>Estimates</button>
            <button type="button" onClick={() => setTab("templates")} className={`acm-btn ${tab === "templates" ? "acm-btn-primary" : "acm-btn-secondary"} h-10 px-4`}>Templates</button>
          </div>
        </div>
      </section>

      {error ? <div className="acm-message-error">{error}</div> : null}
      {(clientsQuery.loading || templatesQuery.loading || estimatesQuery.loading || settingsQuery.loading) ? (
        <div className={cardClass("p-5 text-sm text-[color:var(--acm-muted-fg)]")}>Loading estimate workspace...</div>
      ) : null}

      {tab === "templates" ? (
        <div className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className={cardClass("p-5")}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xl font-bold">Template Library</div>
                <button type="button" onClick={() => setTemplateForm(emptyTemplateForm())} className="acm-btn acm-btn-secondary h-10 px-4">New Template</button>
              </div>
              <div className="mt-4 space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                {templates.map((template) => (
                  <CompactListRow
                    key={template.id}
                    primary={template.name}
                    secondary={template.is_default ? "Default template" : template.template_kind || "Template"}
                    tertiary={`${template.configuration?.branding?.templateHeader || "Estimate"} | ${template.configuration?.branding?.badgeLabel || "Standard"}`}
                    onClick={() => openTemplate(template)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <form onSubmit={saveTemplate} className={cardClass("p-5")}>
              <div className="text-xl font-bold">Template Branding</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <LabeledInput label="Template Name">
                  <input className={inputClass()} value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} />
                </LabeledInput>
                <LabeledInput label="Badge Label">
                  <input className={inputClass()} value={templateForm.configuration.branding.badgeLabel} onChange={(event) => setTemplateForm((current) => ({ ...current, configuration: { ...current.configuration, branding: { ...current.configuration.branding, badgeLabel: event.target.value } } }))} />
                </LabeledInput>
                <LabeledInput label="Header">
                  <input className={inputClass()} value={templateForm.configuration.branding.templateHeader} onChange={(event) => setTemplateForm((current) => ({ ...current, configuration: { ...current.configuration, branding: { ...current.configuration.branding, templateHeader: event.target.value } } }))} />
                </LabeledInput>
                <LabeledInput label="Subheader">
                  <input className={inputClass()} value={templateForm.configuration.branding.templateSubheader} onChange={(event) => setTemplateForm((current) => ({ ...current, configuration: { ...current.configuration, branding: { ...current.configuration.branding, templateSubheader: event.target.value } } }))} />
                </LabeledInput>
                <label className="flex items-center gap-3 rounded-[18px] border border-[color:var(--acm-border)] px-4 py-3">
                  <input type="checkbox" checked={templateForm.isDefault} onChange={(event) => setTemplateForm((current) => ({ ...current, isDefault: event.target.checked }))} />
                  <span className="text-sm font-semibold">Make this the default template</span>
                </label>
              </div>

              <div className="mt-5 rounded-[20px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Template Fields</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["title", "Title"],
                    ["estimateDate", "Estimate Date"],
                    ["validUntil", "Valid Until"],
                    ["client", "Customer"],
                    ["customerEmail", "Customer Email"],
                    ["customerPhone", "Customer Phone"],
                    ["customerAddress", "Customer Address"],
                    ["template", "Template"],
                    ["notes", "Notes"],
                    ["terms", "Terms"],
                    ["signature", "Signature"],
                    ["stamp", "Stamp"],
                  ].map(([fieldKey, label]) => (
                    <label key={fieldKey} className="flex items-center gap-3 rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-4 py-3 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={templateForm.configuration.fields?.basicDetails?.[fieldKey] !== false}
                        onChange={(event) =>
                          setTemplateForm((current) => ({
                            ...current,
                            configuration: normalizeTemplateConfiguration({
                              ...current.configuration,
                              fields: {
                                ...normalizeTemplateConfiguration(current.configuration).fields,
                                basicDetails: {
                                  ...normalizeTemplateConfiguration(current.configuration).fields.basicDetails,
                                  [fieldKey]: event.target.checked,
                                },
                              },
                            }),
                          }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[20px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Labour Defaults</div>
                <div className="mt-4 grid gap-4">
                  <LabeledInput label="Labour Classifications">
                    <textarea
                      className={inputClass("min-h-[90px]")}
                      value={(normalizeTemplateConfiguration(templateForm.configuration).laborLibrary?.classifications || []).join("\n")}
                      onChange={(event) =>
                        setTemplateForm((current) => ({
                          ...current,
                          configuration: {
                            ...normalizeTemplateConfiguration(current.configuration),
                            laborLibrary: {
                              ...normalizeTemplateConfiguration(current.configuration).laborLibrary,
                              classifications: event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
                            },
                          },
                        }))
                      }
                      placeholder="One classification per line"
                    />
                  </LabeledInput>

                  <div>
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">Rate Default Values</div>
                    <div className="space-y-3">
                      {normalizeTemplateConfiguration(templateForm.configuration).laborLibrary.rateDefaults.map((rate) => (
                        <div key={rate.id} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                          <input className={inputClass()} placeholder="Rate name" value={rate.name} onChange={(event) => updateTemplateRate(rate.id, "name", event.target.value)} />
                          <input className={inputClass()} placeholder="Rate value (%)" value={rate.value} onChange={(event) => updateTemplateRate(rate.id, "value", event.target.value)} />
                          <button type="button" onClick={() => removeTemplateRate(rate.id)} className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] text-lg font-bold text-rose-600">×</button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <button type="button" onClick={addTemplateRate} className="acm-btn acm-btn-secondary h-10 px-4">Add Rate Default</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ColorPaletteInput label="Accent" value={templateBranding.accentColor} options={BRAND_PALETTES.accentColor} onChange={(value) => setTemplateForm((current) => ({ ...current, configuration: normalizeTemplateConfiguration({ ...current.configuration, branding: { ...normalizeTemplateConfiguration(current.configuration).branding, accentColor: value } }) }))} />
                <ColorPaletteInput label="Canvas" value={templateBranding.canvasTint} options={BRAND_PALETTES.canvasTint} onChange={(value) => setTemplateForm((current) => ({ ...current, configuration: normalizeTemplateConfiguration({ ...current.configuration, branding: { ...normalizeTemplateConfiguration(current.configuration).branding, canvasTint: value } }) }))} />
                <ColorPaletteInput label="Surface" value={templateBranding.surfaceTint} options={BRAND_PALETTES.surfaceTint} onChange={(value) => setTemplateForm((current) => ({ ...current, configuration: normalizeTemplateConfiguration({ ...current.configuration, branding: { ...normalizeTemplateConfiguration(current.configuration).branding, surfaceTint: value } }) }))} />
                <ColorPaletteInput label="Text" value={templateBranding.textColor} options={BRAND_PALETTES.textColor} onChange={(value) => setTemplateForm((current) => ({ ...current, configuration: normalizeTemplateConfiguration({ ...current.configuration, branding: { ...normalizeTemplateConfiguration(current.configuration).branding, textColor: value } }) }))} />
              </div>

              <div className="mt-5 flex justify-end">
                <BusyButton type="submit" busy={templateBusy} className="acm-btn acm-btn-primary h-11 px-5">Save Template</BusyButton>
              </div>
              </form>

              <EstimatePreviewCard form={{ ...form, companyName: companyDetails.name, companyAddress: companyDetails.address, companyLogoText: companyDetails.logoText, companyLogoUrl: companyDetails.logoDataUrl }} selectedTemplate={{ configuration: normalizeTemplateConfiguration(templateForm.configuration) }} totals={uiTotals} />
            </div>
          </section>
          {message ? <div className="rounded-[18px] border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]">{message}</div> : null}
        </div>
      ) : (
        <section className="space-y-6">
          <section className={cardClass("p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-bold">Estimate Records</div>
              <button type="button" onClick={newEstimate} className="acm-btn acm-btn-secondary h-10 px-4">New</button>
            </div>
            <div className="mt-4 max-h-[280px] overflow-y-auto pr-1">
              <div className="grid gap-3 lg:grid-cols-2">
              {estimates.map((estimate) => (
                <CompactListRow
                  key={estimate.id}
                  primary={estimate.title || `Estimate #${estimate.estimate_number}`}
                  secondary={`${estimate.client?.name || "Client"} | ${formatDate(estimate.estimate_date)} | ${formatCurrency(estimate.summary?.finalBid || estimate.summary?.totalPrice)}`}
                  // tertiary={`${formatCurrency(estimate.summary?.finalBid || estimate.summary?.totalPrice)} | ${String(estimate.status || "draft").toUpperCase()}`}
                  onClick={() => loadEstimate(estimate)}
                  actions={<StatusPill status={estimate.status || "draft"} />}
                />
              ))}
              </div>
            </div>
            {message ? <div className="mt-4 rounded-[18px] border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]">{message}</div> : null}
          </section>

          <div className="space-y-6">
            <section className={cardClass("overflow-hidden")}>
              <div className="border-b border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    {companyDetails.logoDataUrl ? (
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] bg-white">
                        <img src={companyDetails.logoDataUrl} alt="Company logo" className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[color:var(--acm-accent)] text-lg font-extrabold text-white">
                        {companyDetails.logoText}
                      </div>
                    )}
                    <div>
                      <div className="text-lg font-bold text-[color:var(--acm-fg)]">{companyDetails.name}</div>
                      <div className="text-sm text-[color:var(--acm-muted-fg)]">{companyDetails.address || "Complete company address in profile/settings"}</div>
                      <div className="text-sm text-[color:var(--acm-muted-fg)]">{[companyDetails.phone, companyDetails.email].filter(Boolean).join(" | ") || "Complete company phone and email in profile/settings"}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--acm-muted-fg)]">{selectedTemplate?.configuration?.branding?.templateHeader || "Estimate"}</div>
                    <div className="mt-2 text-3xl font-extrabold tracking-tight text-[color:var(--acm-fg)]">{form.id ? `#${estimates.find((item) => item.id === form.id)?.estimate_number || "Saved"}` : "Auto"}</div>
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <StatusPill status={form.status} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <BusyButton type="button" busy={previewBusy || busy} onClick={() => openPdf("preview")} className="acm-btn acm-btn-primary h-10 px-4">Preview PDF</BusyButton>
                    <BusyButton type="button" busy={sendBusy} onClick={handleSend} disabled={!form.id || !pdfReviewed} className="acm-btn acm-btn-secondary h-10 px-4">Send</BusyButton>
                    <BusyButton type="button" busy={busy} onClick={duplicateEstimate} className="acm-btn acm-btn-secondary h-10 px-4">Duplicate</BusyButton>
                    {form.id ? <button type="button" onClick={() => deleteEstimate(form.id)} className="acm-btn acm-btn-secondary h-10 px-4">Delete</button> : null}
                  </div>
                  <div className="rounded-full border border-[color:var(--acm-border)] px-4 py-2 text-sm font-semibold text-[color:var(--acm-muted-fg)]">
                    Auto-save is active while you edit.
                  </div>
                </div>
              </div>

              {error ? (
                <div className="px-5 pb-2">
                  <div className="acm-message-error">{error}</div>
                </div>
              ) : null}

              <div className="px-5 pb-5">
                <div className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-1">
                    <div className="rounded-[24px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                      <div className="mb-4 text-lg font-bold">Estimate Details</div>
                      <div className="grid gap-4">
                        <LabeledInput label="Select the Template">
                          <select className={inputClass()} value={form.templateId || selectedTemplate?.id || ""} onChange={(event) => updateEstimate("templateId", event.target.value)}>
                            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                          </select>
                        </LabeledInput>
                        <div className="grid gap-4 md:grid-cols-4">
                        <LabeledInput label="Title">
                          <input className={inputClass()} value={form.title} onChange={(event) => updateEstimate("title", event.target.value)} />
                        </LabeledInput>
                        <LabeledInput label="Date">
                          <input type="date" className={inputClass()} value={form.estimateDate} onChange={(event) => updateEstimate("estimateDate", event.target.value)} />
                        </LabeledInput>
                        <LabeledInput label="Valid Until">
                          <input type="date" className={inputClass()} value={form.validUntil} onChange={(event) => updateEstimate("validUntil", event.target.value)} />
                        </LabeledInput>
                        <LabeledInput label="Customer">
                          <select className={inputClass()} value={form.clientId} onChange={(event) => updateEstimate("clientId", event.target.value)}>
                            <option value="">Select a customer</option>
                            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                          </select>
                        </LabeledInput>
                        <LabeledInput label="Customer Email">
                          <input className={inputClass()} value={form.customerEmail} onChange={(event) => updateEstimate("customerEmail", event.target.value)} />
                        </LabeledInput>
                        <LabeledInput label="Customer Phone">
                          <input className={inputClass()} value={form.customerPhone} onChange={(event) => updateEstimate("customerPhone", event.target.value)} />
                        </LabeledInput>
                        <div className="md:col-span-2">
                          <LabeledInput label="Customer Address">
                            <textarea className={inputClass("min-h-[96px]")} value={form.customerAddress} onChange={(event) => updateEstimate("customerAddress", event.target.value)} />
                          </LabeledInput>
                        </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {form.costLines.map((line, lineIndex) => {
                      const lineSummary = computeCostLineSummary(line);
                      return (
                        <div key={line.id} className="rounded-[28px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="grid flex-1 gap-3 md:grid-cols-[180px_180px_minmax(0,1fr)]">
                              <div className="rounded-[16px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-sm font-semibold">
                                Cost Line {lineIndex + 1}
                              </div>
                              <input className={inputClass()} value={line.code || ""} onChange={(event) => updateLine(line.id, "code", event.target.value)} placeholder="Code" />
                              <input className={inputClass("min-w-[220px]")} value={line.description} onChange={(event) => updateLine(line.id, "description", event.target.value)} placeholder="Cost line title" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => openCostLineDetails(line.id)} className="acm-btn acm-btn-primary h-10 px-4">Open Details Page</button>
                              {form.costLines.length > 1 ? (
                                <button type="button" onClick={() => removeCostLine(line.id)} className="acm-btn acm-btn-secondary h-10 px-4">Remove Line</button>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[20px] border border-[color:var(--acm-border)]">
                              <thead>
                                <tr className="bg-[color:var(--acm-surface-2)] text-left text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
                                  <th className="px-4 py-3">Labor</th>
                                  <th className="px-4 py-3">Material</th>
                                  <th className="px-4 py-3">Equipment</th>
                                  <th className="px-4 py-3">Overhead</th>
                                  <th className="px-4 py-3">Total</th>
                                  <th className="px-4 py-3">Rows</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="text-sm text-[color:var(--acm-fg)]">
                                  <td className="border-t border-[color:var(--acm-border)] px-4 py-4">{formatCurrency(lineSummary.laborCost)}</td>
                                  <td className="border-t border-[color:var(--acm-border)] px-4 py-4">{formatCurrency(lineSummary.materialCost)}</td>
                                  <td className="border-t border-[color:var(--acm-border)] px-4 py-4">{formatCurrency(lineSummary.equipmentCost)}</td>
                                  <td className="border-t border-[color:var(--acm-border)] px-4 py-4">{formatCurrency(lineSummary.overheadCost)}</td>
                                  <td className="border-t border-[color:var(--acm-border)] px-4 py-4 font-bold">{formatCurrency(lineSummary.total)}</td>
                                  <td className="border-t border-[color:var(--acm-border)] px-4 py-4 text-[color:var(--acm-muted-fg)]">
                                    L {lineSummary.laborCount} | M {lineSummary.materialCount} | E {lineSummary.equipmentCount} | O {lineSummary.overheadCount}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex justify-end">
                      <button type="button" onClick={addCostLine} className="acm-btn acm-btn-secondary h-11 rounded-full px-5">Add Cost Line</button>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[24px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                      <div className="mb-4 text-lg font-bold">Notes & Terms</div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <LabeledInput label="Overhead %">
                          <input className={inputClass()} value={form.overheadPercent} onChange={(event) => updateEstimate("overheadPercent", event.target.value)} />
                        </LabeledInput>
                        <LabeledInput label="Profit %">
                          <input className={inputClass()} value={form.profitPercent} onChange={(event) => updateEstimate("profitPercent", event.target.value)} />
                        </LabeledInput>
                        <LabeledInput label="Notes">
                          <textarea className={inputClass("min-h-[94px]")} value={form.notes} onChange={(event) => updateEstimate("notes", event.target.value)} />
                        </LabeledInput>
                        <LabeledInput label="Terms">
                          <textarea className={inputClass("min-h-[94px]")} value={form.terms} onChange={(event) => updateEstimate("terms", event.target.value)} />
                        </LabeledInput>
                        <LabeledInput label="Signature Label">
                          <input className={inputClass()} value={form.signatureLabel} onChange={(event) => updateEstimate("signatureLabel", event.target.value)} />
                        </LabeledInput>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <MetricCard label="Subtotal" value={formatCurrency(uiTotals.subtotal)} />
                      <MetricCard label="Discount" value={formatCurrency(uiTotals.discountAmount)} />
                      <MetricCard label="Tax Breakdown" value={formatCurrency(uiTotals.taxAmount)} note="Calculated inline from section rates" />
                      <MetricCard label="Additional Charges" value={formatCurrency(uiTotals.additionalCharges)} />
                      <MetricCard label="Grand Total" value={formatCurrency(uiTotals.grandTotal)} tone="accent" />
                    </div>

                    

                    <div className={cardClass("p-4")}>
                    <div className="text-lg font-bold">Status Management</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusButton active={form.status === "draft"} onClick={() => updateEstimate("status", "draft")}>Draft</StatusButton>
                      <StatusButton active={form.status === "sent"} onClick={handleSend}>Sent</StatusButton>
                      <StatusButton active={form.status === "approved"} onClick={handleApprove}>Approved</StatusButton>
                      <StatusButton active={form.status === "rejected"} onClick={handleReject}>Rejected</StatusButton>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      )}
    </div>
  );
}

export default EstimateDashboardPage;
