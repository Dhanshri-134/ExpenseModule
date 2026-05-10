"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { BusyButton, CompactListRow } from "@/components/dashboard/DashboardUi";
import { ChevronRightIcon } from "@/components/dashboard/icons";
import Modal from "@/components/dashboard/Modal";
import { invalidateApiQuery, useApiQuery } from "@/lib/client/apiQuery";
import {Trash} from "lucide-react";

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

function sheetInputClass(extra = "") {
  return `w-full border-0 border-b border-[color:var(--acm-border)] bg-white px-1 py-2 text-sm text-[color:var(--acm-fg)] outline-none focus:border-[color:var(--acm-accent)] focus:ring-0 ${extra}`.trim();
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

function formatDecimalInput(value) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return "";
  return String(Number(numeric.toFixed(2)));
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

function parseApiResponseText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return { detail: trimmed };
  }
}

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
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
    code: "",
    description: "",
    classification: "",
    straightTimePersons: "",
    straightTimeDays: "",
    overtimePersons: "",
    overtimeDays: "",
    targetWage: "",
    targetWageBase: "",
    targetWageMarkupPercent: "",
    overheadPercent: "",
    profitPercent: "",
  };
}

function createSubcontractorEntry() {
  return {
    id: createId("subcontractor"),
    code: "",
    description: "",
    cost: "",
    workersCompPercent: "",
    liabilityPercent: "",
    overheadPercent: "",
    profitPercent: "",
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
    overheadPercent: "",
    profitPercent: "",
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
    overheadPercent: "",
    profitPercent: "",
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
    subcontractorEntries: [createSubcontractorEntry()],
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
    estimateNumber: "",
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
    companyLogoText: "",
    overheadPercent: "0",
    profitPercent: "0",
    commissionPercent: "0",
    riskPercent: "0",
    inflationRate: "0",
    escalationYears: "0",
    discountType: "percent",
    discountValue: "0",
    shippingCharge: "0",
    additionalCharges: "0",
    signatureLabel: "By",
    costLines: [createCostLine(1)],
  };
}

function calculateLabor(entry) {
  const targetWage = toNumber(entry.targetWage);
  const stHours = toNumber(entry.straightTimePersons) * 8 * toNumber(entry.straightTimeDays);
  const otHours = toNumber(entry.overtimePersons) * 10 * toNumber(entry.overtimeDays);
  const stRate = targetWage * 1.55;
  const otRate = targetWage * 2.24;
  const totalAmount = stHours * stRate + otHours * otRate;

  return {
    stHours,
    stRate,
    otHours,
    otRate,
    total: totalAmount,
    targetPay: stHours * targetWage,
    taxAmount: 0,
  };
}

function calculateSubcontractor(entry) {
  const cost = toNumber(entry.cost);
  const workersCompAmount = cost * toPercent(entry.workersCompPercent);
  const liabilityAmount = cost * toPercent(entry.liabilityPercent);
  const total = cost + workersCompAmount + liabilityAmount;

  return {
    cost,
    workersCompAmount,
    liabilityAmount,
    total,
    taxAmount: 0,
  };
}

function applyRowMarkup(baseTotal, entry) {
  const overheadAmount = baseTotal * toPercent(entry?.overheadPercent);
  const profitAmount = (baseTotal + overheadAmount) * toPercent(entry?.profitPercent);
  return {
    overheadAmount,
    profitAmount,
    finalTotal: baseTotal + overheadAmount + profitAmount,
  };
}

function calculateMaterial(entry) {
  const quantity = toNumber(entry.quantity);
  const wasteQty = quantity + quantity * toPercent(entry.wastePercent);
  const unitRate = toNumber(entry.unitRate);
  const cost = quantity * unitRate;
  const freight = toNumber(entry.freight);
  const costWithFreight = cost + freight;
  const taxAmount = costWithFreight * toPercent(entry.taxPercent);
  return {
    wasteQty,
    unitRate,
    cost,
    freight,
    costWithFreight,
    subtotal: costWithFreight,
    taxAmount,
    total: costWithFreight + taxAmount,
  };
}

function calculateEquipment(entry) {
  const quantity = toNumber(entry.quantity);
  const rentalDays = Math.max(toNumber(entry.rentalDays), 0);
  const unitRate = toNumber(entry.unitRate);
  const cost = quantity * unitRate;
  const freight = toNumber(entry.freight);
  const fuel = (cost + freight) * toPercent(entry.fuelPercent);
  const costWithFreight = cost + freight;
  const costWithFuel = costWithFreight + fuel;
  const taxAmount = costWithFuel * toPercent(entry.taxPercent);
  return {
    quantity,
    rentalDays,
    unitRate,
    cost,
    freight,
    fuel,
    costWithFreight,
    costWithFuel,
    subtotal: costWithFuel,
    taxAmount,
    total: costWithFuel + taxAmount,
  };
}

function flattenEstimateCostLines(costCodes = []) {
  const merged = createCostLine(1);
  merged.code = "ESTIMATE";
  merged.description = "Estimate";
  merged.laborEntries = [];
  merged.subcontractorEntries = [];
  merged.materialEntries = [];
  merged.equipmentEntries = [];
  merged.overheadEntries = [];

  (costCodes ?? []).forEach((line) => {
    (line.laborEntries ?? []).forEach((entry) => {
      if (entry.metadata?.kind === "subcontractor") {
        merged.subcontractorEntries.push({
          id: entry.id || createId("subcontractor"),
          code: entry.metadata?.code || line.costCode?.code || "",
          description: entry.description || entry.metadata?.description || "",
          cost: entry.metadata?.cost ?? "",
          workersCompPercent: entry.metadata?.workersCompPercent ?? "",
          liabilityPercent: entry.metadata?.liabilityPercent ?? "",
          overheadPercent: entry.metadata?.overheadPercent ?? "",
          profitPercent: entry.metadata?.profitPercent ?? "",
        });
        return;
      }

      merged.laborEntries.push({
        id: entry.id || createId("labor"),
        code: entry.metadata?.code || line.costCode?.code || "",
        description: entry.metadata?.description || entry.metadata?.title || entry.description || "",
        classification: entry.metadata?.classification || "",
        straightTimePersons: entry.metadata?.straightTimePersons ?? "",
        straightTimeDays: entry.metadata?.straightTimeDays ?? "",
        overtimePersons: entry.metadata?.overtimePersons ?? "",
        overtimeDays: entry.metadata?.overtimeDays ?? "",
        targetWage: entry.metadata?.targetWage ?? "",
        targetWageBase: entry.metadata?.targetWageBase ?? entry.metadata?.targetWage ?? "",
        targetWageMarkupPercent: entry.metadata?.targetWageMarkupPercent ?? "",
        overheadPercent: entry.metadata?.overheadPercent ?? "",
        profitPercent: entry.metadata?.profitPercent ?? "",
      });
    });

    (line.materialEntries ?? []).forEach((entry) => {
      merged.materialEntries.push({
        id: entry.id || createId("material"),
        code: entry.metadata?.code || line.costCode?.code || "",
        description: entry.description || "",
        quantity: entry.quantity ?? "",
        uom: entry.metadata?.uom || "",
        unitRate: entry.unitRate ?? "",
        wastePercent: toNumber(entry.wastePercent) * 100,
        freight: entry.freight ?? "",
        taxPercent: toNumber(entry.taxPercent) * 100,
        overheadPercent: entry.metadata?.overheadPercent ?? "",
        profitPercent: entry.metadata?.profitPercent ?? "",
      });
    });

    (line.equipmentEntries ?? []).forEach((entry) => {
      merged.equipmentEntries.push({
        id: entry.id || createId("equipment"),
        code: entry.metadata?.code || line.costCode?.code || "",
        description: entry.description || "",
        quantity: entry.qty ?? "",
        rentalDays: entry.days ?? "",
        unitRate: entry.rate ?? "",
        freight: entry.freight ?? "",
        fuelPercent: entry.metadata?.fuelPercent ?? "",
        taxPercent: toNumber(entry.taxPercent) * 100,
        overheadPercent: entry.metadata?.overheadPercent ?? "",
        profitPercent: entry.metadata?.profitPercent ?? "",
      });
    });
  });

  if (!merged.laborEntries.length) merged.laborEntries = [createLaborEntry()];
  if (!merged.subcontractorEntries.length) merged.subcontractorEntries = [createSubcontractorEntry()];
  if (!merged.materialEntries.length) merged.materialEntries = [createMaterialEntry()];
  if (!merged.equipmentEntries.length) merged.equipmentEntries = [createEquipmentEntry()];
  merged.overheadEntries = [];
  return [merged];
}

function calculateOverhead(entry) {
  const quantity = toNumber(entry.quantity);
  const days = Math.max(toNumber(entry.days), 1);
  const unitRate = toNumber(entry.unitRate);
  const cost = quantity * unitRate * days;
  const taxAmount = cost * toPercent(entry.taxPercent);
  return {
    quantity,
    days,
    unitRate,
    cost,
    subtotal: cost,
    taxAmount,
    total: cost + taxAmount,
  };
}

function computeUiTotals(form, previewSummary) {
  const taxAmount = form.costLines.reduce((sum, line) => {
    const laborTax = (line.laborEntries ?? []).reduce((acc, entry) => acc + calculateLabor(entry).taxAmount, 0);
    const subcontractorTax = (line.subcontractorEntries ?? []).reduce((acc, entry) => acc + calculateSubcontractor(entry).taxAmount, 0);
    const materialTax = (line.materialEntries ?? []).reduce((acc, entry) => acc + calculateMaterial(entry).taxAmount, 0);
    const equipmentTax = (line.equipmentEntries ?? []).reduce((acc, entry) => acc + calculateEquipment(entry).taxAmount, 0);
    const overheadTax = (line.overheadEntries ?? []).reduce((acc, entry) => acc + calculateOverhead(entry).taxAmount, 0);
    return sum + laborTax + subcontractorTax + materialTax + equipmentTax + overheadTax;
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
  const laborCost =
    (line.laborEntries ?? []).reduce((sum, entry) => sum + calculateLabor(entry).total, 0) +
    (line.subcontractorEntries ?? []).reduce((sum, entry) => sum + calculateSubcontractor(entry).total, 0);
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
    laborCount: (line.laborEntries ?? []).length + (line.subcontractorEntries ?? []).length,
    materialCount: (line.materialEntries ?? []).length,
    equipmentCount: (line.equipmentEntries ?? []).length,
    overheadCount: (line.overheadEntries ?? []).length,
  };
}

function buildClientPreviewSummary(form) {
  const lineSummaries = (form.costLines ?? []).map(computeCostLineSummary);
  const laborBase = (form.costLines ?? []).reduce(
    (sum, line) =>
      sum +
      (line.laborEntries ?? []).reduce((entrySum, entry) => entrySum + calculateLabor(entry).total, 0) +
      (line.subcontractorEntries ?? []).reduce((entrySum, entry) => entrySum + calculateSubcontractor(entry).total, 0),
    0
  );
  const materialBase = (form.costLines ?? []).reduce((sum, line) => sum + (line.materialEntries ?? []).reduce((entrySum, entry) => entrySum + calculateMaterial(entry).total, 0), 0);
  const equipmentBase = (form.costLines ?? []).reduce((sum, line) => sum + (line.equipmentEntries ?? []).reduce((entrySum, entry) => entrySum + calculateEquipment(entry).total, 0), 0);
  const laborMarkup = (form.costLines ?? []).reduce(
    (sum, line) =>
      sum +
      (line.laborEntries ?? []).reduce((entrySum, entry) => entrySum + applyRowMarkup(calculateLabor(entry).total, entry).overheadAmount, 0) +
      (line.subcontractorEntries ?? []).reduce((entrySum, entry) => entrySum + applyRowMarkup(calculateSubcontractor(entry).total, entry).overheadAmount, 0),
    0
  );
  const materialMarkup = (form.costLines ?? []).reduce((sum, line) => sum + (line.materialEntries ?? []).reduce((entrySum, entry) => entrySum + applyRowMarkup(calculateMaterial(entry).total, entry).overheadAmount, 0), 0);
  const equipmentMarkup = (form.costLines ?? []).reduce((sum, line) => sum + (line.equipmentEntries ?? []).reduce((entrySum, entry) => entrySum + applyRowMarkup(calculateEquipment(entry).total, entry).overheadAmount, 0), 0);
  const laborProfit = (form.costLines ?? []).reduce(
    (sum, line) =>
      sum +
      (line.laborEntries ?? []).reduce((entrySum, entry) => entrySum + applyRowMarkup(calculateLabor(entry).total, entry).profitAmount, 0) +
      (line.subcontractorEntries ?? []).reduce((entrySum, entry) => entrySum + applyRowMarkup(calculateSubcontractor(entry).total, entry).profitAmount, 0),
    0
  );
  const materialProfit = (form.costLines ?? []).reduce((sum, line) => sum + (line.materialEntries ?? []).reduce((entrySum, entry) => entrySum + applyRowMarkup(calculateMaterial(entry).total, entry).profitAmount, 0), 0);
  const equipmentProfit = (form.costLines ?? []).reduce((sum, line) => sum + (line.equipmentEntries ?? []).reduce((entrySum, entry) => entrySum + applyRowMarkup(calculateEquipment(entry).total, entry).profitAmount, 0), 0);
  const baseCost = laborBase + materialBase + equipmentBase;
  const overheadAmount = laborMarkup + materialMarkup + equipmentMarkup;
  const profitAmount = laborProfit + materialProfit + equipmentProfit;
  const totalPrice = baseCost + overheadAmount + profitAmount;
  const overheadPercent = 0;
  const profitPercent = 0;
  const commissionPercent = toPercent(form.commissionPercent);
  const riskPercent = toPercent(form.riskPercent);
  const inflationRate = toPercent(form.inflationRate);
  const escalationYears = toNumber(form.escalationYears);
  const commissionAmount = (baseCost + overheadAmount + profitAmount) * commissionPercent;
  const contingencyAmount = (baseCost + overheadAmount + profitAmount + commissionAmount) * riskPercent;
  const totalPriceWithAdjustments = totalPrice + commissionAmount + contingencyAmount;
  const futureCost = totalPriceWithAdjustments * inflationRate * Math.max(escalationYears, 0);

  return {
    laborCost: laborBase,
    materialCost: materialBase,
    equipmentCost: equipmentBase,
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
    totalPrice: totalPriceWithAdjustments,
    finalBid: totalPriceWithAdjustments + futureCost,
  };
}

function buildPayload(form, selectedTemplate, previewSummary, companyDetails) {
  const totals = computeUiTotals(form, previewSummary);
  const generatedTitle =
    String(form.customerName || "").trim()
      ? `${String(form.customerName || "").trim()} Estimate`
      : form.estimateNumber
        ? `Estimate #${form.estimateNumber}`
        : `Estimate ${form.estimateDate || new Date().toISOString().slice(0, 10)}`;
  const primaryLine = form.costLines?.[0] || createCostLine(1);

  return {
    id: form.id || undefined,
    estimateNumber: form.estimateNumber,
    clientId: form.clientId,
    templateId: form.templateId || selectedTemplate?.id || undefined,
    title: generatedTitle,
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
    costCodes: [{
      code: "ESTIMATE",
      name: "Estimate",
      description: "Estimate",
      laborEntries: primaryLine.laborEntries.map((entry) => {
        const derived = calculateLabor(entry);
        const markup = applyRowMarkup(derived.total, entry);
        return {
          description: entry.description,
          stHours: derived.stHours,
          stRate: derived.stRate,
          otHours: derived.otHours,
          otRate: derived.otRate,
          metadata: {
            code: entry.code?.trim() || undefined,
            description: entry.description,
            classification: entry.classification,
            straightTimePersons: toNumber(entry.straightTimePersons),
            straightTimeDays: toNumber(entry.straightTimeDays),
            overtimePersons: toNumber(entry.overtimePersons),
            overtimeDays: toNumber(entry.overtimeDays),
            targetWage: toNumber(entry.targetWage),
            targetWageBase: toNumber(entry.targetWageBase || entry.targetWage),
            targetWageMarkupPercent: toNumber(entry.targetWageMarkupPercent),
            overheadPercent: toNumber(entry.overheadPercent),
            profitPercent: toNumber(entry.profitPercent),
            overheadAmount: markup.overheadAmount,
            profitAmount: markup.profitAmount,
            finalTotal: markup.finalTotal,
            targetPay: derived.targetPay,
          },
        };
      }).concat(
        primaryLine.subcontractorEntries.map((entry) => {
          const derived = calculateSubcontractor(entry);
          const markup = applyRowMarkup(derived.total, entry);
          return {
            description: entry.description,
            stHours: 1,
            stRate: derived.total,
            otHours: 0,
            otRate: 0,
            metadata: {
              kind: "subcontractor",
              code: entry.code?.trim() || undefined,
              description: entry.description,
              cost: toNumber(entry.cost),
              workersCompPercent: toNumber(entry.workersCompPercent),
              liabilityPercent: toNumber(entry.liabilityPercent),
              overheadPercent: toNumber(entry.overheadPercent),
              profitPercent: toNumber(entry.profitPercent),
              workersCompAmount: derived.workersCompAmount,
              liabilityAmount: derived.liabilityAmount,
              overheadAmount: markup.overheadAmount,
              profitAmount: markup.profitAmount,
              finalTotal: markup.finalTotal,
            },
          };
        })
      ),
      materialEntries: primaryLine.materialEntries.map((entry) => {
        const derived = calculateMaterial(entry);
        const markup = applyRowMarkup(derived.total, entry);
        return ({
        description: entry.description,
        quantity: entry.quantity,
        wastePercent: entry.wastePercent,
        unitRate: entry.unitRate,
        freight: entry.freight,
        taxPercent: entry.taxPercent,
        metadata: {
          code: entry.code?.trim() || undefined,
          uom: entry.uom,
          wasteQty: derived.wasteQty,
          cost: derived.cost,
          costWithFreight: derived.costWithFreight,
          taxAmount: derived.taxAmount,
          total: derived.total,
          overheadPercent: toNumber(entry.overheadPercent),
          profitPercent: toNumber(entry.profitPercent),
          overheadAmount: markup.overheadAmount,
          profitAmount: markup.profitAmount,
          finalTotal: markup.finalTotal,
        },
      })}),
      equipmentEntries: primaryLine.equipmentEntries.map((entry) => {
        const derived = calculateEquipment(entry);
        const markup = applyRowMarkup(derived.total, entry);
        return ({
        description: entry.description,
        qty: entry.quantity,
        days: entry.rentalDays,
        rate: entry.unitRate,
        freight: entry.freight,
        fuel: derived.fuel,
        taxPercent: entry.taxPercent,
        metadata: {
          code: entry.code?.trim() || undefined,
          fuelPercent: toNumber(entry.fuelPercent),
          cost: derived.cost,
          costWithFreight: derived.costWithFreight,
          costWithFuel: derived.costWithFuel,
          taxAmount: derived.taxAmount,
          total: derived.total,
          overheadPercent: toNumber(entry.overheadPercent),
          profitPercent: toNumber(entry.profitPercent),
          overheadAmount: markup.overheadAmount,
          profitAmount: markup.profitAmount,
          finalTotal: markup.finalTotal,
        },
      })}),
      overheadEntries: [],
    }],
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
    estimateNumber: String(estimate.estimate_number || ""),
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
    costLines: (estimate.cost_codes ?? []).length ? flattenEstimateCostLines(estimate.cost_codes) : [createCostLine(1)],
  };
}

function LabeledInput({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[color:var(--acm-muted-fg)]">{label}</span>
      {children}
    </label>
  );
}

function InlineMessage({ error, message, onDismiss }) {
  if (!error && !message) return null;

  return (
    <div className={error ? "acm-message-error" : "rounded-xl border border-[color:var(--acm-accent-border)] bg-[color:var(--acm-accent-soft)] px-4 py-3 text-sm text-[color:var(--acm-accent-strong)]"}>
      <div className="flex items-start justify-between gap-3">
        <span>{error || message}</span>
        {onDismiss ? <button type="button" onClick={onDismiss} className="text-sm font-semibold">Close</button> : null}
      </div>
    </div>
  );
}

function DetailStack({ lines = [] }) {
  const visibleLines = lines.filter((line) => String(line || "").trim());
  if (!visibleLines.length) return null;

  return (
    <div className="space-y-1">
      {visibleLines.map((line, index) => (
        <div key={`${line}-${index}`}>{line}</div>
      ))}
    </div>
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

function FormulaGrid({ items = [] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <MetricCard key={item.label} label={item.label} value={item.value} note={item.note} tone={item.tone || "default"} />
      ))}
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

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[20px] border border-black/8 p-4" style={{ background: palette.surface }}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-65">{form.signatureLabel || "Signature"}</div>
          <div className="mt-3 flex min-h-[88px] items-end justify-center rounded-[16px] bg-white/80 p-3">
            {form.signatureDataUrl ? (
              <img src={form.signatureDataUrl} alt="Signature" className="max-h-[72px] w-full object-contain" />
            ) : (
              <span className="text-sm opacity-60">{form.signatureName || "No signature"}</span>
            )}
          </div>
        </div>
        <div className="rounded-[20px] border border-black/8 p-4" style={{ background: palette.surface }}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-65">Stamp</div>
          <div className="mt-3 flex min-h-[88px] items-end justify-center rounded-[16px] bg-white/80 p-3">
            {form.stampDataUrl ? (
              <img src={form.stampDataUrl} alt="Stamp" className="max-h-[72px] w-full object-contain" />
            ) : (
              <span className="text-sm opacity-60">{form.stampLabel || "No stamp"}</span>
            )}
          </div>
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
  if (type === "textarea") {
    return (
      <textarea
        list={list}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={3}
        data-grid-input="true"
        className={sheetInputClass("min-w-[180px] resize-y text-[0.7rem]")}
      />
    );
  }

  return (
    <input
      type={type}
      list={list}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      data-grid-input="true"
      className={sheetInputClass("min-w-[84px] text-[0.7rem] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
    />
  );
}

function TargetWageTrigger({ value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${sheetInputClass("min-w-[120px] rounded-md border border-[color:var(--acm-border)] px-2 text-left text-[0.7rem] font-semibold")} cursor-pointer`}
    >
      {value ? `${formatCurrency(value)}/hr` : "Set target wage"}
    </button>
  );
}

function buildVisibleColumns(columns) {
  const visible = [];
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index];
    const nextColumn = columns[index + 1];
    if (column.key === "description" && visible.at(-1)?.key === "code") continue;
    if (column.key === "code" && nextColumn?.key === "description") {
      visible.push({ ...column, width: nextColumn.width || column.width, pairedDescriptionColumn: nextColumn });
      index += 1;
      continue;
    }
    visible.push(column);
  }
  return visible;
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
  addLabel,
  summaryColumns = [],
  context = null,
}) {
  const visibleColumns = buildVisibleColumns(columns);
  const stackedDetailColumn = visibleColumns.find((column) => column.type === "textarea");
  const tableColumns = stackedDetailColumn ? visibleColumns.filter((column) => column.key !== stackedDetailColumn.key) : visibleColumns;
  const derivedRows = rows.map((row) =>
    sectionKey === "laborEntries"
      ? calculateLabor(row)
      : sectionKey === "subcontractorEntries"
        ? calculateSubcontractor(row)
      : sectionKey === "materialEntries"
        ? calculateMaterial(row)
        : sectionKey === "equipmentEntries"
          ? calculateEquipment(row)
          : calculateOverhead(row)
  );
  return (
    <div className="space-y-3">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 py-2 text-left">
        <div>
          <div className="text-base font-bold text-[color:var(--acm-fg)]">{title}</div>
          {/* <div className="text-sm text-[color:var(--acm-muted-fg)]">{rows.length} row{rows.length === 1 ? "" : "s"}</div> */}
        </div>
        <ChevronRightIcon className={`h-5 w-5 transition ${collapsed ? "" : "rotate-90"}`} />
      </button>

      {!collapsed ? (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
                  {tableColumns.map((column) => (
                    <th key={column.key} className={`px-2 py-2 font-semibold text-[0.6rem] ${column.width || ""}`}>{column.label}</th>
                  ))}
                  {summaryColumns.map((column) => (
                    <th key={column.key} className={`px-2 py-2 font-semibold text-[0.6rem] ${column.width || ""}`}>{column.label}</th>
                  ))}
                  <th className="px-2 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody data-grid-scope={sectionKey}>
                {rows.map((row, index) => {
                  const derived = derivedRows[index];
                  const detailColSpan = tableColumns.length + summaryColumns.length + 1;
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-t border-[color:var(--acm-border)] align-top">
                        {tableColumns.map((column) => (
                          <td key={column.key} className="px-1 py-1 text-[0.6rem]">
                            {column.pairedDescriptionColumn ? (
                              <div className="min-w-[18rem] w-full space-y-2">
                                <TableCellInput
                                  value={row[column.key]}
                                  list={column.listId || (column.list ? datalistId : undefined)}
                                  type={column.type || "text"}
                                  placeholder={column.placeholder}
                                  onChange={(event) => onChange(row.id, column.key, event.target.value)}
                                  onKeyDown={onKeyDown}
                                />
                                <div className="space-y-1">
                                  <div className="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--acm-muted-fg)]">
                                    {column.pairedDescriptionColumn.label}
                                  </div>
                                  <TableCellInput
                                    value={row[column.pairedDescriptionColumn.key]}
                                    list={column.pairedDescriptionColumn.listId || (column.pairedDescriptionColumn.list ? datalistId : undefined)}
                                    type={column.pairedDescriptionColumn.type || "text"}
                                    placeholder={column.pairedDescriptionColumn.placeholder}
                                    onChange={(event) => onChange(row.id, column.pairedDescriptionColumn.key, event.target.value)}
                                    onKeyDown={onKeyDown}
                                  />
                                </div>
                              </div>
                            ) : (
                              column.renderInput ? (
                                column.renderInput({
                                  row,
                                  column,
                                  derived,
                                  context,
                                  onChange: (nextValue) => onChange(row.id, column.key, nextValue),
                                })
                              ) : (
                                <TableCellInput
                                  value={row[column.key]}
                                  list={column.listId || (column.list ? datalistId : undefined)}
                                  type={column.type || "text"}
                                  placeholder={column.placeholder}
                                  onChange={(event) => onChange(row.id, column.key, event.target.value)}
                                  onKeyDown={onKeyDown}
                                />
                              )
                            )}
                          </td>
                        ))}
                        {summaryColumns.map((column) => (
                          <td key={column.key} className="px-2 py-3 text-sm font-semibold text-[color:var(--acm-fg)]">
                            {column.render(row, derived)}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right">
                          {rows.length > 1 ? (
                            <button type="button" onClick={() => onRemove(row.id)} className="rounded-full px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                              <Trash size={16}/>
                            </button>
                          ) : (
                            null
                          )}
                        </td>
                      </tr>
                      {stackedDetailColumn ? (
                        <tr className="border-b border-[color:var(--acm-border)]">
                          <td colSpan={detailColSpan} className="px-2 pb-3 pt-1">
                            <div className="rounded-2xl border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-3">
                              <div className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">
                                {stackedDetailColumn.label}
                              </div>
                              <TableCellInput
                                value={row[stackedDetailColumn.key]}
                                list={stackedDetailColumn.listId || (stackedDetailColumn.list ? datalistId : undefined)}
                                type={stackedDetailColumn.type || "text"}
                                placeholder={stackedDetailColumn.placeholder}
                                onChange={(event) => onChange(row.id, stackedDetailColumn.key, event.target.value)}
                                onKeyDown={onKeyDown}
                              />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {datalistId && datalistOptions?.length ? (
            <datalist id={datalistId}>
              {datalistOptions.map((option) => (
                <option key={option.label} value={option.label} />
              ))}
            </datalist>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onAdd} className="text-sm font-semibold text-[color:var(--acm-accent)]">
              {addLabel || `Add ${title}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EstimateDashboardPage({ roleBase = "owner", initialEstimateId = "", initialCostLineId = "", standalone = false }) {
  const router = useRouter();
  const clientsQuery = useApiQuery("/api/clients");
  const settingsQuery = useApiQuery("/api/settings");
  const templatesQuery = useApiQuery("/api/estimate-templates");
  const estimateListQuery = useApiQuery(standalone ? null : "/api/estimates?compact=1");
  const estimateDetailQuery = useApiQuery(initialEstimateId ? `/api/estimates?id=${initialEstimateId}` : null);
  const costCodesQuery = useApiQuery("/api/cost-codes");

  const [editorOpen, setEditorOpen] = useState(Boolean(initialEstimateId || standalone));
  const [activeAction, setActiveAction] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(() => emptyEstimateForm());
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [activeEstimateId, setActiveEstimateId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pdfReviewed, setPdfReviewed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [selectedCostLineId, setSelectedCostLineId] = useState(initialCostLineId);
  const [statusDraft, setStatusDraft] = useState("draft");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [targetWageDialog, setTargetWageDialog] = useState({
    open: false,
    lineId: "",
    rowId: "",
    baseWage: "",
    markupPercent: "",
  });
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectEstimateId, setProjectEstimateId] = useState("");
  const [projectForm, setProjectForm] = useState({
    name: "",
    location: "",
    clientMode: "existing",
    clientId: "",
    clientName: "",
    clientContact: "",
    clientEmail: "",
    clientAddress: "",
  });
  const initialDetailHydratedRef = useRef(false);

  const clients = useMemo(() => clientsQuery.data?.clients ?? [], [clientsQuery.data?.clients]);
  const profile = useMemo(() => settingsQuery.data?.profile ?? null, [settingsQuery.data?.profile]);
  const templates = useMemo(
    () => (templatesQuery.data?.templates ?? []).map((template) => ({ ...template, configuration: normalizeTemplateConfiguration(template.configuration) })),
    [templatesQuery.data?.templates]
  );
  const estimateList = useMemo(() => estimateListQuery.data?.estimates ?? [], [estimateListQuery.data?.estimates]);
  const filteredEstimateList = useMemo(
    () =>
      estimateList.filter((estimate) =>
        matchesSearchQuery(
          searchQuery,
          estimate.title,
          estimate.estimate_number,
          estimate.client?.name,
          estimate.client?.email,
          estimate.status,
          estimate.summary?.finalBid,
          estimate.summary?.totalPrice
        )
      ),
    [estimateList, searchQuery]
  );
  const detailedEstimate = useMemo(() => estimateDetailQuery.data?.estimates?.[0] || null, [estimateDetailQuery.data?.estimates]);
  const costCodeSuggestions = useMemo(
    () => (costCodesQuery.data?.costCodes ?? []).map((item) => ({ label: item.code, description: item.description || item.name || "" })),
    [costCodesQuery.data?.costCodes]
  );
  const refreshEstimateQueries = useCallback(async () => {
    await Promise.all([
      standalone ? Promise.resolve(null) : estimateListQuery.refresh().catch(() => null),
      initialEstimateId ? estimateDetailQuery.refresh().catch(() => null) : Promise.resolve(null),
    ]);
  }, [estimateDetailQuery, estimateListQuery, initialEstimateId, standalone]);

  const defaultTemplate = useMemo(() => templates.find((item) => item.is_default) || templates[0] || null, [templates]);
  const companyDetails = useMemo(() => {
    const company = settingsQuery.data?.company || null;
    const metadata = company?.metadata && typeof company.metadata === "object" ? company.metadata : {};
    const name =
      String(company?.name || metadata.name || profile?.name || "Your Company").trim() || "Your Company";
    const address = String(company?.address || metadata.address || profile?.address || "").trim();
    const email = String(company?.email || metadata.email || profile?.email || "").trim();
    const phone = String(company?.contact || metadata.contact || metadata.phone || profile?.mobile || "").trim();
    return {
      name,
      address,
      email,
      phone,
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

    const suggestionSource = standalone ? [detailedEstimate].filter(Boolean) : [];

    suggestionSource.forEach((estimate) => {
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
  }, [detailedEstimate, standalone]);

  useEffect(() => {
    if (!initialEstimateId || initialDetailHydratedRef.current || !detailedEstimate) return;
    initialDetailHydratedRef.current = true;
    queueMicrotask(() => {
      setForm(mapEstimateToForm(detailedEstimate, templates));
      setActiveEstimateId(detailedEstimate.id);
      setSelectedCostLineId(initialCostLineId || detailedEstimate.cost_codes?.[0]?.id || "");
      setPdfReviewed(false);
      setDirty(false);
      setStatusDraft(detailedEstimate.status || "draft");
    });
  }, [detailedEstimate, initialCostLineId, initialEstimateId, templates]);

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

  function openTargetWageDialog(lineId, row) {
    setTargetWageDialog({
      open: true,
      lineId,
      rowId: row.id,
      baseWage: row.targetWageBase || row.targetWage || "",
      markupPercent: row.targetWageMarkupPercent || "",
    });
  }

  function closeTargetWageDialog() {
    setTargetWageDialog({
      open: false,
      lineId: "",
      rowId: "",
      baseWage: "",
      markupPercent: "",
    });
  }

  function applyTargetWageDialog(event) {
    event.preventDefault();
    const baseWage = toNumber(targetWageDialog.baseWage);
    const markupPercent = toNumber(targetWageDialog.markupPercent);
    const finalWage = baseWage * (1 + markupPercent / 100);

    setForm((current) => ({
      ...current,
      costLines: current.costLines.map((line) => {
        if (line.id !== targetWageDialog.lineId) return line;
        return {
          ...line,
          laborEntries: (line.laborEntries ?? []).map((row) =>
            row.id === targetWageDialog.rowId
              ? {
                  ...row,
                  targetWage: formatDecimalInput(finalWage),
                  targetWageBase: formatDecimalInput(baseWage),
                  targetWageMarkupPercent: formatDecimalInput(markupPercent),
                }
              : row
          ),
        };
      }),
    }));
    setDirtyState();
    closeTargetWageDialog();
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
      subcontractorEntries: createSubcontractorEntry,
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

  async function handleStatusAction() {
    const nextStatus = String(statusDraft || form.status || "draft").toLowerCase();
    if (!["draft", "sent", "approved", "rejected"].includes(nextStatus)) {
      setError("Select a valid status.");
      return;
    }

    if (nextStatus === "sent") {
      const sent = await handleSend();
      if (sent) setStatusDialogOpen(false);
      return;
    }

    if (nextStatus === "approved") {
      setActiveAction("status");
      let createdEstimate = null;
      if (!form.id) {
        createdEstimate = await persistEstimate({ busyKey: "status" });
        if (!createdEstimate) {
          setActiveAction("");
          return;
        }
      }
      const estimateId = createdEstimate?.id || form.id || activeEstimateId;
      const res = await fetch("/api/estimate-workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estimateId, action: "approve" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setActiveAction("");
        setError(formatApiError(json, "Unable to update estimate status."));
        return;
      }
      invalidateApiQuery("/api/estimates?compact=1");
      invalidateApiQuery("/api/estimates");
      await refreshEstimateQueries();
      setForm((current) => ({ ...current, status: "approved", approvalStatus: "approved" }));
      setMessage("Estimate approved.");
      setStatusDialogOpen(false);
      setActiveAction("");
      return;
    }

    const saved = await persistEstimate({ status: nextStatus, busyKey: "status" });
    if (saved) setStatusDialogOpen(false);
  }

  async function handleSend() {
    if (!pdfReviewed) {
      setError("Open the latest PDF preview before sending.");
      return false;
    }
    if (!window.confirm(`Send "${form.title || "Estimate"}" to ${form.customerEmail || "the customer"} using the configured SMTP account?`)) {
      return false;
    }

    const saved = await persistEstimate({ silent: true, busyKey: "send" });
    if (!saved) return false;

    setActiveAction("send");
    setError("");
    setMessage("");
    const res = await fetch("/api/estimates/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estimateId: saved.id || form.id || activeEstimateId, confirmSend: true }),
    });
    const json = await res.json().catch(() => null);
    setActiveAction("");

    if (!res.ok) {
      setError(formatApiError(json, "Unable to send estimate."));
      return false;
    }

    invalidateApiQuery("/api/estimates?compact=1");
    invalidateApiQuery("/api/estimates");
    await refreshEstimateQueries();
    setForm((current) => ({ ...current, status: "sent" }));
    setMessage("Estimate sent from the configured SMTP account.");
    return true;
  }

  function newEstimate() {
    if (!standalone) {
      router.push(`/${roleBase}/estimates/new`);
      return;
    }

    if (standalone && initialEstimateId) {
      router.push(`/${roleBase}/estimates/new`);
      return;
    }

    setForm(emptyEstimateForm("", defaultTemplate?.id || ""));
    setActiveEstimateId("");
    setSelectedCostLineId("");
    setPdfReviewed(false);
    setDirty(false);
    setError("");
    setMessage("");
    setStatusDraft("draft");
    setEditorOpen(true);
  }

  function loadEstimate(estimate) {
    if (!standalone) {
      router.push(`/${roleBase}/estimates/${estimate.id}`);
      return;
    }

    setForm(mapEstimateToForm(estimate, templates));
    setActiveEstimateId(estimate.id);
    setSelectedCostLineId("");
    setPdfReviewed(false);
    setDirty(false);
    setError("");
    setMessage("");
    setStatusDraft(estimate.status || "draft");
    setEditorOpen(true);
  }

  function openProjectDialog(estimate) {
    const source = estimate || estimateList.find((item) => item.id === form.id) || detailedEstimate || null;
    const sourceClient = source?.client || clients.find((client) => client.id === (source?.client_id || form.clientId)) || null;
    setProjectEstimateId(source?.id || form.id || "");
    setProjectForm({
      name: source?.title || form.title || sourceClient?.name || form.customerName || "Project",
      location: sourceClient?.address || form.customerAddress || "",
      clientMode: sourceClient?.id ? "existing" : "new",
      clientId: sourceClient?.id || source?.client_id || form.clientId || "",
      clientName: sourceClient?.name || form.customerName || "",
      clientContact: sourceClient?.contact || form.customerPhone || "",
      clientEmail: sourceClient?.email || form.customerEmail || "",
      clientAddress: sourceClient?.address || form.customerAddress || "",
    });
    setProjectDialogOpen(true);
  }

  async function createProjectFromEstimate(event) {
    event.preventDefault();
    if (projectBusy || !projectEstimateId) return;

    setProjectBusy(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/estimate-project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        estimateId: projectEstimateId,
        name: projectForm.name,
        location: projectForm.location,
        clientId: projectForm.clientMode === "existing" ? projectForm.clientId || null : null,
        clientName: projectForm.clientMode === "new" ? projectForm.clientName : null,
        clientContact: projectForm.clientMode === "new" ? projectForm.clientContact : null,
        clientEmail: projectForm.clientMode === "new" ? projectForm.clientEmail : null,
        clientAddress: projectForm.clientMode === "new" ? projectForm.clientAddress : null,
        startDate: "",
        endDate: "",
      }),
    });
    const json = await res.json().catch(() => null);
    setProjectBusy(false);

    if (!res.ok) {
      setError(formatApiError(json, "Unable to create project from estimate."));
      return;
    }

    invalidateApiQuery("/api/projects");
    invalidateApiQuery("/api/estimates?compact=1");
    invalidateApiQuery("/api/estimates");
    await refreshEstimateQueries();
    setProjectDialogOpen(false);
    setMessage("Project created from estimate.");
  }

  async function openPdf(mode = "download") {
    setActiveAction("preview");
    const saved = await persistEstimate({ silent: true, busyKey: "preview" });
    if (!saved) {
      return;
    }
    const estimateId = saved.id || form.id || activeEstimateId;
    if (!estimateId) {
      setActiveAction("");
      return;
    }
    const url = `/api/estimates?id=${estimateId}&export=pdf&disposition=inline`;
    window.open(url, "_blank", "noopener,noreferrer");
    setActiveAction("");
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

    const hasRows = form.costLines.some((line) =>
      [...(line.laborEntries ?? []), ...(line.subcontractorEntries ?? []), ...(line.materialEntries ?? []), ...(line.equipmentEntries ?? [])].some((entry) =>
        Object.entries(entry).some(([key, value]) => {
          if (key === "id") return false;
          if (typeof value === "string") return value.trim().length > 0;
          return Boolean(value);
        })
      )
    );

    if (!hasRows) return "Add at least one estimate row.";
    return "";
  }, [companyDetails.address, companyDetails.email, companyDetails.name, companyDetails.phone, form]);

  const persistEstimate = useCallback(async ({ status, silent = false, busyKey = "save" } = {}) => {
    const validationError = validateEstimate();
    if (validationError) {
      setError(validationError);
      return false;
    }

    const nextApprovalStatus =
      status === "rejected" ? "rejected" : status === "draft" ? "draft" : payload.approvalStatus;
    const nextPayload = status ? { ...payload, status, approvalStatus: nextApprovalStatus } : payload;
    setActiveAction(busyKey);
    setError("");
    if (!silent) setMessage("");

    const res = await fetch("/api/estimates", {
      method: form.id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextPayload),
    });
    const responseText = await res.text().catch(() => "");
    const json = parseApiResponseText(responseText);
    setActiveAction("");

    if (!res.ok) {
      setError(formatApiError(json, `Unable to save estimate.${responseText ? ` ${String(responseText).slice(0, 220)}` : ""}`));
      return false;
    }

    const saved = json?.estimate;
    if (saved) {
      setForm(mapEstimateToForm(saved, templates));
      setActiveEstimateId(saved.id);
      setDirty(false);
      invalidateApiQuery("/api/estimates?compact=1");
      invalidateApiQuery("/api/estimates");
      if (!standalone) estimateListQuery.refresh().catch(() => null);
      if (!silent) setMessage(status === "sent" ? "Estimate marked as sent." : "Estimate saved.");
      return saved;
    }
    return false;
  }, [payload, templates, validateEstimate, estimateListQuery, standalone]);

  const laborColumns = [
    { key: "description", label: "Scope of work", placeholder: "Scope of work", type: "textarea" },
    { key: "classification", label: "Classification", placeholder: "Classification", width: "w-40" },
    { key: "straightTimePersons", label: "ST Persons",  placeholder: "0", width: "w-20" },
    { key: "straightTimeDays", label: "ST Days",  placeholder: "0", width: "w-20" },
    { key: "overtimePersons", label: "OT Persons",  placeholder: "0", width: "w-20" },
    { key: "overtimeDays", label: "OT Days",  placeholder: "0" },
    {
      key: "targetWage",
      label: "Labor Rate",
      placeholder: "0",
      renderInput: ({ row, context }) => (
        <TargetWageTrigger value={row.targetWage} onClick={() => openTargetWageDialog(context?.lineId || "", row)} />
      ),
    },
    { key: "overheadPercent", label: "Overhead",  placeholder: "0" },
    { key: "profitPercent", label: "Profit",  placeholder: "0" },
  ];

  const subcontractorColumns = [
    { key: "description", label: "Description", placeholder: "Description", width: "w-72", type: "textarea" },
    { key: "cost", label: "Cost", placeholder: "0" },
    { key: "workersCompPercent", label: "WC %", placeholder: "0" },
    { key: "liabilityPercent", label: "GL %", placeholder: "0" },
    { key: "overheadPercent", label: "Overhead %", placeholder: "0" },
    { key: "profitPercent", label: "Profit %", placeholder: "0" },
  ];

  const materialColumns = [
    { key: "description", label: "Scope of work", placeholder: "Scope of work", width: "w-72", type: "textarea" },
    { key: "quantity", label: "Quantity",  placeholder: "0" },
    { key: "uom", label: "UOM", placeholder: "Unit" },
    { key: "wastePercent", label: "Waste %",  placeholder: "0" },
    { key: "unitRate", label: "Rate",  placeholder: "0" },
    { key: "freight", label: "Freight ($)",  placeholder: "0" },
    { key: "taxPercent", label: "Tax %",  placeholder: "0" },
    { key: "overheadPercent", label: "Overhead",  placeholder: "0" },
    { key: "profitPercent", label: "Profit",  placeholder: "0" },
  ];

  const equipmentColumns = [
    { key: "description", label: "Scope of work",  placeholder: "Scope of work", width: "w-72", type: "textarea" },
    { key: "quantity", label: "Quantity",  placeholder: "0" },
    { key: "rentalDays", label: "Rental Days",  placeholder: "0" },
    { key: "unitRate", label: "Rate",  placeholder: "0" },
    { key: "freight", label: "Freight ($)",  placeholder: "0" },
    { key: "fuelPercent", label: "Fuel %",  placeholder: "0" },
    { key: "taxPercent", label: "Tax %",  placeholder: "0" },
    { key: "overheadPercent", label: "Overhead",  placeholder: "0" },
    { key: "profitPercent", label: "Profit",  placeholder: "0" },
  ];

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* <div>
            <div className="text-lg font-bold text-[color:var(--acm-fg)]">{standalone ? "Estimate" : "Estimate Records"}</div>
            <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">
              {standalone ? "Review and edit this estimate on its own page." : "Open an estimate from the list or start a new one."}
            </div>
          </div> */}
          <div className="flex flex-wrap gap-2 justify-end w-full">
            {standalone ? (
              <button type="button" onClick={() => router.push(`/${roleBase}/estimates`)} className="acm-btn acm-btn-secondary h-10 px-4">Back</button>
            ) : null}
            <button type="button" onClick={newEstimate} className="acm-btn acm-btn-primary h-10 px-4">New Estimate</button>
          </div>
        </div>
      </section>

      <InlineMessage error={error} message={message} onDismiss={() => { setError(""); setMessage(""); }} />

      {!standalone ? (
        <section className="space-y-5">
          {(clientsQuery.loading || templatesQuery.loading || estimateListQuery.loading || settingsQuery.loading) ? (
            <div className="text-sm text-[color:var(--acm-muted-fg)]">Loading estimate workspace...</div>
          ) : null}
          <div>
            <input className={sheetInputClass()} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search estimates by title, number, client, status, or value" />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {filteredEstimateList.map((estimate) => (
              <CompactListRow
                key={estimate.id}
                primary={estimate.title || `Estimate #${estimate.estimate_number}`}
                secondary={
                  <DetailStack
                    lines={[
                      estimate.client?.name || "Client",
                      formatDate(estimate.estimate_date),
                    ]}
                  />
                }
                tertiary={
                  <DetailStack
                    lines={[
                      formatCurrency(estimate.summary?.finalBid || estimate.summary?.totalPrice),
                    ]}
                  />
                }
                onClick={() => loadEstimate(estimate)}
                actions={<StatusPill status={estimate.status || "draft"} />}
              />
            ))}
            {!filteredEstimateList.length ? (
              <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-8 text-sm text-[color:var(--acm-muted-fg)] lg:col-span-3">
                No estimates match the current search.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {editorOpen ? (
        <section className="space-y-6">
          <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--acm-border)] pb-4">
                <div>
                  <div className="text-lg font-bold text-[color:var(--acm-fg)]">{companyDetails.name}</div>
                  <div className="text-sm text-[color:var(--acm-muted-fg)]">{companyDetails.address || "Complete company address in profile/settings"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--acm-muted-fg)]">Estimate</div>
                  <div className="mt-1 text-2xl font-extrabold tracking-tight text-[color:var(--acm-fg)]">{form.estimateNumber ? `#${form.estimateNumber}` : "Draft"}</div>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <StatusPill status={form.status} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <BusyButton type="button" busy={activeAction === "preview"} onClick={() => openPdf("preview")} className="acm-btn acm-btn-primary h-10 px-4">Preview PDF</BusyButton>
                  <BusyButton
                    type="button"
                    busy={activeAction === "status" || activeAction === "send"}
                    onClick={() => {
                      setStatusDraft(form.status || "draft");
                      setStatusDialogOpen(true);
                    }}
                    className="acm-btn acm-btn-secondary h-10 px-4"
                  >
                    Change Status
                  </BusyButton>
                  <BusyButton type="button" busy={activeAction === "save"} onClick={() => persistEstimate()} className="acm-btn acm-btn-secondary h-10 px-4">Save Details</BusyButton>
                  {form.id ? (
                    <button type="button" onClick={() => openProjectDialog()} className="acm-btn acm-btn-secondary h-10 px-4">
                      Open Project
                    </button>
                  ) : null}
                </div>
                {/* <div className="text-sm font-semibold text-[color:var(--acm-muted-fg)]">{dirty ? "Unsaved changes" : "All changes saved manually"}</div> */}
              </div>

              <div className="grid gap-6 md:grid-cols-4">
                <LabeledInput label="Estimate No">
                  <input className={sheetInputClass()} inputMode="numeric" value={form.estimateNumber} onChange={(event) => updateEstimate("estimateNumber", event.target.value.replace(/[^\d]/g, ""))} />
                </LabeledInput>
                <LabeledInput label="Estimate Date">
                  <input type="date" className={sheetInputClass()} value={form.estimateDate} onChange={(event) => updateEstimate("estimateDate", event.target.value)} />
                </LabeledInput>
                <LabeledInput label="Valid Until">
                  <input type="date" className={sheetInputClass()} value={form.validUntil} onChange={(event) => updateEstimate("validUntil", event.target.value)} />
                </LabeledInput>
                <LabeledInput label="Customer">
                  <select className={sheetInputClass()} value={form.clientId} onChange={(event) => updateEstimate("clientId", event.target.value)}>
                    <option value="">Select customer</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name || client.email || "Customer"}</option>
                    ))}
                  </select>
                </LabeledInput>
              </div>

              <div className="space-y-8">
                {form.costLines.map((line, index) => (
                  <div key={line.id} className="  ">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                      <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,140px)_minmax(280px,1fr)] md:items-center">
                        <div className="text-sm font-semibold text-[color:var(--acm-fg)]">Cost Code</div>
                        <input
                          className={sheetInputClass()}
                          list="estimate-cost-code-options"
                          placeholder={`Cost code ${index + 1}`}
                          value={line.code}
                          onChange={(event) => updateLine(line.id, "code", event.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        {/* <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">
                          Section {index + 1}
                        </div> */}
                        {form.costLines.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeCostLine(line.id)}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-8">
                      <SectionTable
                        title="Labor"
                        addLabel="Add Other Labor"
                        sectionKey="laborEntries"
                        rows={line.laborEntries ?? []}
                        columns={laborColumns}
                        context={{ lineId: line.id }}
                        summaryColumns={[
                          { key: "targetPay", label: "Target Pay", render: (row, derived) => formatCurrency(derived.targetPay) },
                        ]}
                        onChange={(rowId, key, value) => updateEntry(line.id, "laborEntries", rowId, key, value)}
                        onAdd={() => addEntry(line.id, "laborEntries")}
                        onRemove={(rowId) => removeEntry(line.id, "laborEntries", rowId)}
                        onKeyDown={handleGridKeyDown}
                        collapsed={collapsedSections[`${line.id}:laborEntries`]}
                        onToggle={() => toggleSection(line.id, "laborEntries")}
                      />

                      <SectionTable
                        title="Subcontractor"
                        addLabel="Add Subcontractor"
                        sectionKey="subcontractorEntries"
                        rows={line.subcontractorEntries ?? []}
                        columns={subcontractorColumns}
                        summaryColumns={[
                          { key: "finalTotal", label: "Total", render: (row, derived) => formatCurrency(applyRowMarkup(derived.total, row).finalTotal) },
                        ]}
                        onChange={(rowId, key, value) => updateEntry(line.id, "subcontractorEntries", rowId, key, value)}
                        onAdd={() => addEntry(line.id, "subcontractorEntries")}
                        onRemove={(rowId) => removeEntry(line.id, "subcontractorEntries", rowId)}
                        onKeyDown={handleGridKeyDown}
                        collapsed={collapsedSections[`${line.id}:subcontractorEntries`]}
                        onToggle={() => toggleSection(line.id, "subcontractorEntries")}
                      />

                      <SectionTable
                        title="Material"
                        addLabel="Add Other Material"
                        sectionKey="materialEntries"
                        rows={line.materialEntries ?? []}
                        columns={materialColumns}
                        summaryColumns={[
                          { key: "finalTotal", label: "Total", render: (row, derived) => formatCurrency(applyRowMarkup(derived.total, row).finalTotal) },
                        ]}
                        onChange={(rowId, key, value) => updateEntry(line.id, "materialEntries", rowId, key, value)}
                        onAdd={() => addEntry(line.id, "materialEntries")}
                        onRemove={(rowId) => removeEntry(line.id, "materialEntries", rowId)}
                        onKeyDown={handleGridKeyDown}
                        collapsed={collapsedSections[`${line.id}:materialEntries`]}
                        onToggle={() => toggleSection(line.id, "materialEntries")}
                      />

                      <SectionTable
                        title="Equipment"
                        addLabel="Add Other Equipment"
                        sectionKey="equipmentEntries"
                        rows={line.equipmentEntries ?? []}
                        columns={equipmentColumns}
                        summaryColumns={[
                          { key: "finalTotal", label: "Total", render: (row, derived) => formatCurrency(applyRowMarkup(derived.total, row).finalTotal) },
                        ]}
                        onChange={(rowId, key, value) => updateEntry(line.id, "equipmentEntries", rowId, key, value)}
                        onAdd={() => addEntry(line.id, "equipmentEntries")}
                        onRemove={(rowId) => removeEntry(line.id, "equipmentEntries", rowId)}
                        onKeyDown={handleGridKeyDown}
                        collapsed={collapsedSections[`${line.id}:equipmentEntries`]}
                        onToggle={() => toggleSection(line.id, "equipmentEntries")}
                      />
                    </div>
                  </div>
                ))}

                <div className="flex justify-end">
                  <button type="button" onClick={addCostLine} className="acm-btn acm-btn-secondary h-10 px-4">
                    Add Cost Code
                  </button>
                </div>
              </div>

              <datalist id="estimate-cost-code-options">
                {costCodeSuggestions.map((option) => <option key={option.label} value={option.label}>{option.description}</option>)}
              </datalist>
              <datalist id="labor-classification-options">
                {laborClassificationOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
              <datalist id="material-suggestion-options">
                {suggestionLibrary.material.map((option) => <option key={option.label} value={option.label} />)}
              </datalist>
              <datalist id="equipment-suggestion-options">
                {suggestionLibrary.equipment.map((option) => <option key={option.label} value={option.label} />)}
              </datalist>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
                      <th className="py-2">Labor</th>
                      <th className="py-2">Material</th>
                      <th className="py-2">Equipment</th>
                      <th className="py-2">Overhead</th>
                      <th className="py-2">Profit</th>
                      <th className="py-2">Total Estimate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-sm font-semibold text-[color:var(--acm-fg)]">
                      <td className="py-2">{formatCurrency(previewSummary.laborCost)}</td>
                      <td className="py-2">{formatCurrency(previewSummary.materialCost)}</td>
                      <td className="py-2">{formatCurrency(previewSummary.equipmentCost)}</td>
                      <td className="py-2">{formatCurrency(previewSummary.overheadAmount)}</td>
                      <td className="py-2">{formatCurrency(previewSummary.profitAmount)}</td>
                      <td className="py-2">{formatCurrency(previewSummary.totalPrice)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
          </div>
        </section>
      ) : null}

      <Modal open={projectDialogOpen} title="Create Project" onClose={() => setProjectDialogOpen(false)} maxWidth="max-w-2xl">
        <form onSubmit={createProjectFromEstimate} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <LabeledInput label="Project Name">
              <input className={sheetInputClass()} value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} />
            </LabeledInput>
            <LabeledInput label="Client Source">
              <select
                className={sheetInputClass()}
                value={projectForm.clientMode}
                onChange={(event) => {
                  const nextMode = event.target.value;
                  setProjectForm((current) => ({
                    ...current,
                    clientMode: nextMode,
                    clientId: nextMode === "existing" ? current.clientId : "",
                    clientName: "",
                    clientContact: "",
                    clientEmail: "",
                    clientAddress: "",
                  }));
                }}
              >
                <option value="existing">Use Existing Client</option>
                <option value="new">Create New Client</option>
              </select>
            </LabeledInput>
          </div>

          {projectForm.clientMode === "existing" ? (
            <LabeledInput label="Client">
              <select className={sheetInputClass()} value={projectForm.clientId} onChange={(event) => setProjectForm((current) => ({ ...current, clientId: event.target.value }))}>
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </LabeledInput>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <LabeledInput label="Client Name">
                <input className={sheetInputClass()} value={projectForm.clientName} onChange={(event) => setProjectForm((current) => ({ ...current, clientName: event.target.value }))} />
              </LabeledInput>
              <LabeledInput label="Client Contact">
                <input className={sheetInputClass()} value={projectForm.clientContact} onChange={(event) => setProjectForm((current) => ({ ...current, clientContact: event.target.value }))} />
              </LabeledInput>
              <LabeledInput label="Client Email">
                <input className={sheetInputClass()} value={projectForm.clientEmail} onChange={(event) => setProjectForm((current) => ({ ...current, clientEmail: event.target.value }))} />
              </LabeledInput>
              <LabeledInput label="Client Address">
                <textarea className={sheetInputClass("min-h-[96px]")} value={projectForm.clientAddress} onChange={(event) => setProjectForm((current) => ({ ...current, clientAddress: event.target.value }))} />
              </LabeledInput>
            </div>
          )}

          <LabeledInput label="Project Location">
            <textarea className={sheetInputClass("min-h-[96px]")} value={projectForm.location} onChange={(event) => setProjectForm((current) => ({ ...current, location: event.target.value }))} />
          </LabeledInput>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setProjectDialogOpen(false)} className="acm-btn acm-btn-secondary h-10 px-4">Cancel</button>
            <BusyButton type="submit" busy={projectBusy} className="acm-btn acm-btn-primary h-10 px-4">Create Project</BusyButton>
          </div>
        </form>
      </Modal>

      <Modal open={statusDialogOpen} title="Change Status" onClose={() => setStatusDialogOpen(false)} maxWidth="max-w-md">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--acm-border)] pb-3">
            <div>
              <div className="text-sm font-semibold text-[color:var(--acm-fg)]">{form.title || "Estimate"}</div>
              <div className="mt-1 text-xs text-[color:var(--acm-muted-fg)]">Current status</div>
            </div>
            <StatusPill status={form.status} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              ["draft", "Draft"],
              ["sent", "Send"],
              ["rejected", "Reject"],
              ["approved", "Approve"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusDraft(value)}
                className={`h-11 rounded-lg border px-3 text-sm font-semibold transition ${
                  statusDraft === value
                    ? "border-[color:var(--acm-accent)] bg-[color:var(--acm-accent-soft)] text-[color:var(--acm-accent-strong)]"
                    : "border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] text-[color:var(--acm-fg)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStatusDialogOpen(false)} className="acm-btn acm-btn-secondary h-10 px-4">Cancel</button>
            <BusyButton type="button" busy={activeAction === "status" || activeAction === "send"} onClick={handleStatusAction} className="acm-btn acm-btn-primary h-10 px-4">Apply</BusyButton>
          </div>
        </div>
      </Modal>

      <Modal open={targetWageDialog.open} title="Target Wage" onClose={closeTargetWageDialog} maxWidth="max-w-md">
        <form onSubmit={applyTargetWageDialog} className="grid gap-4">
          <LabeledInput label="Target Wage">
            <input
              className={sheetInputClass()}
              inputMode="decimal"
              value={targetWageDialog.baseWage}
              onChange={(event) => setTargetWageDialog((current) => ({ ...current, baseWage: event.target.value }))}
              placeholder="30"
            />
          </LabeledInput>
          <LabeledInput label="Markup %">
            <input
              className={sheetInputClass()}
              inputMode="decimal"
              value={targetWageDialog.markupPercent}
              onChange={(event) => setTargetWageDialog((current) => ({ ...current, markupPercent: event.target.value }))}
              placeholder="20"
            />
          </LabeledInput>
          <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] px-4 py-3 text-sm text-[color:var(--acm-fg)]">
            Calculated Labor Rate: <span className="font-bold">{formatCurrency(toNumber(targetWageDialog.baseWage) * (1 + toNumber(targetWageDialog.markupPercent) / 100))}/hr</span>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="acm-btn acm-btn-primary h-10 px-5">
              OK
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default EstimateDashboardPage;

