import { PDFDocument, rgb } from "pdf-lib";
import sharp from "sharp";

function normalizeNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePercent(value) {
  const parsed = normalizeNumber(value);
  return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
}

function sumValues(items = [], iteratee = (value) => value) {
  return (items ?? []).reduce((sum, item) => sum + normalizeNumber(iteratee(item)), 0);
}

export function normalizeEstimateLineItems(items = []) {
  return (items ?? [])
    .map((item, index) => ({
      id: item?.id || `line-${index + 1}`,
      scope: String(item?.scope || "").trim(),
      costCode: String(item?.costCode || "").trim(),
      description: String(item?.description || "").trim(),
      unit: String(item?.unit || "").trim(),
      quantity: normalizeNumber(item?.quantity),
      laborHours: normalizeNumber(item?.laborHours),
      laborCost: normalizeNumber(item?.laborCost),
      materialCost: normalizeNumber(item?.materialCost),
      equipmentCost: normalizeNumber(item?.equipmentCost),
      directOverheadCost: normalizeNumber(item?.directOverheadCost),
      notes: String(item?.notes || "").trim(),
    }))
    .filter(
      (item) =>
        item.scope ||
        item.costCode ||
        item.description ||
        item.unit ||
        item.quantity ||
        item.laborHours ||
        item.laborCost ||
        item.materialCost ||
        item.equipmentCost ||
        item.directOverheadCost ||
        item.notes
    )
    .map((item) => ({
      ...item,
      totalCost:
        item.laborCost +
        item.materialCost +
        item.equipmentCost +
        item.directOverheadCost,
    }));
}

export function computeEstimateSummary({
  lineItems = [],
  overheadPercent = 0,
  profitPercent = 0,
  commissionPercent = 0,
}) {
  const normalizedLineItems = normalizeEstimateLineItems(lineItems);
  const normalizedOverheadPercent = normalizePercent(overheadPercent);
  const normalizedProfitPercent = normalizePercent(profitPercent);
  const normalizedCommissionPercent = normalizePercent(commissionPercent);

  const totals = normalizedLineItems.reduce(
    (acc, item) => {
      acc.totalLaborHours += item.laborHours;
      acc.laborCost += item.laborCost;
      acc.materialCost += item.materialCost;
      acc.equipmentCost += item.equipmentCost;
      acc.directOverheadCost += item.directOverheadCost;
      acc.baseCost += item.totalCost;
      return acc;
    },
    {
      totalLaborHours: 0,
      laborCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      directOverheadCost: 0,
      baseCost: 0,
    }
  );

  const overheadAmount = totals.baseCost * normalizedOverheadPercent;
  const profitAmount = (totals.baseCost + overheadAmount) * normalizedProfitPercent;
  const commissionAmount =
    (totals.baseCost + overheadAmount + profitAmount) * normalizedCommissionPercent;
  const totalPrice =
    totals.baseCost + overheadAmount + profitAmount + commissionAmount;

  return {
    ...totals,
    overheadPercent: normalizedOverheadPercent,
    profitPercent: normalizedProfitPercent,
    commissionPercent: normalizedCommissionPercent,
    overheadAmount,
    profitAmount,
    commissionAmount,
    totalPrice,
  };
}

export function estimateToCsv(estimate) {
  const lineItems = normalizeEstimateLineItems(estimate?.line_items ?? []);
  const summary = estimate?.summary || computeEstimateSummary({
    lineItems,
    overheadPercent: estimate?.overhead_percent ?? 0,
    profitPercent: estimate?.profit_percent ?? 0,
    commissionPercent: estimate?.commission_percent ?? 0,
  });

  const rows = [
    ["Estimate Title", estimate?.title || ""],
    ["Estimate Number", estimate?.estimate_number || ""],
    ["Estimate Date", estimate?.estimate_date || ""],
    ["Status", estimate?.status || ""],
    [],
    [
      "Scope",
      "Cost Code",
      "Description",
      "Unit",
      "Quantity",
      "Labor Hours",
      "Labor (Employee) Cost",
      "Material Cost",
      "Equipment Cost",
      "Direct Overhead Cost",
      "Line Total",
      "Notes",
    ],
    ...lineItems.map((item) => [
      item.scope,
      item.costCode,
      item.description,
      item.unit,
      item.quantity,
      item.laborHours,
      item.laborCost,
      item.materialCost,
      item.equipmentCost,
      item.directOverheadCost,
      item.totalCost,
      item.notes,
    ]),
    [],
    ["Base Cost", summary.baseCost],
    ["Overhead %", summary.overheadPercent],
    ["Overhead Amount", summary.overheadAmount],
    ["Profit %", summary.profitPercent],
    ["Profit Amount", summary.profitAmount],
    ["Commission %", summary.commissionPercent],
    ["Commission Amount", summary.commissionAmount],
    ["Total Price", summary.totalPrice],
  ];

  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
}

export function mergeEstimateSummaryMeta(summary, existingSummary = {}) {
  const existingMeta =
    existingSummary?.documentMeta && typeof existingSummary.documentMeta === "object"
      ? existingSummary.documentMeta
      : {};

  return {
    ...summary,
    documentMeta: existingMeta,
  };
}

function escapePdfText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replaceAll(/\r?\n/g, " ");
}

function wrapPdfLine(value, maxLength = 92) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [""];

  const segments = text.split("\n");
  const lines = [];

  segments.forEach((segment) => {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }

    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxLength && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });

    if (current) lines.push(current);
  });

  return lines.length ? lines : [""];
}

function formatPdfCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(normalizeNumber(value));
}

function compactDetailParts(parts = []) {
  return parts
    .filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "number") return value !== 0;
      return String(value).trim() !== "";
    })
    .map(([label, value]) => `${label}: ${value}`)
    .join(" | ");
}

function formatPdfPercent(value) {
  const percent = normalizePercent(value) * 100;
  return `${percent.toFixed(1)}%`;
}

function formatPdfDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function hexToRgb(hex, fallback = [30, 58, 138]) {
  const normalized = String(hex || "").trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function pdfColor(rgb) {
  return rgb.map((value) => (value / 255).toFixed(3)).join(" ");
}

function flattenEstimateRows(estimate) {
  const invoiceEntries = estimate?.summary?.documentMeta?.invoice?.entries;
  if (Array.isArray(invoiceEntries) && invoiceEntries.length) {
    return invoiceEntries
      .map((entry, index) => ({
        item: `INV-${index + 1}`,
        label: String(entry?.scope || "").trim() || `Entry ${index + 1}`,
        totalPrice: normalizeNumber(entry?.total),
      }))
      .filter((entry) => entry.label || entry.totalPrice);
  }

  const rows = [];

  (estimate?.cost_codes ?? []).forEach((costCode, index) => {
    const groupLabel =
      costCode.costCode?.name ||
      costCode.costCode?.code ||
      costCode.description ||
      `Cost Line ${index + 1}`;
    const totalPrice = normalizeNumber(costCode.totalPrice || costCode.totalCost);
    rows.push({
      code: costCode.costCode?.code || `CL-${index + 1}`,
      label: groupLabel,
      description: costCode.description || costCode.costCode?.description || "",
      totalPrice,
    });
  });

  if (rows.length) return rows;

  const lineItems = normalizeEstimateLineItems(estimate?.line_items ?? []);
  if (lineItems.length) {
    return lineItems.map((item) => ({
      item: item.costCode || item.scope || "Line Item",
      description: [item.description, item.notes].filter(Boolean).join(" | ") || item.scope || estimate?.title || "Estimate",
      qty: item.quantity || 1,
      rate: item.quantity ? item.totalCost / item.quantity : item.totalCost,
      tax: 0,
      amount: item.totalCost,
    }));
  }

  return [
    { item: "Estimate", description: estimate?.title || "Estimate", qty: 1, rate: 0, tax: 0, amount: normalizeNumber(estimate?.summary?.finalBid || estimate?.summary?.totalPrice) },
  ];
}

function buildCostLineDetailSections(estimate) {
  return (estimate?.cost_codes ?? []).map((costCode, index) => {
    const label = costCode.costCode?.name || costCode.costCode?.code || `Cost Line ${index + 1}`;
    const code = costCode.costCode?.code || "";
    const percent = (value) => (value || value === 0 ? `${normalizeNumber(value).toFixed(1)}%` : "-");
    const subcontractorTotal = (entry) => {
      const baseCost = normalizeNumber(entry.cost);
      const workersCompAmount = baseCost * normalizePercent(entry.workersCompPercent);
      const liabilityAmount = baseCost * normalizePercent(entry.liabilityPercent);
      const subtotal = baseCost + workersCompAmount + liabilityAmount;
      const overheadAmount = subtotal * normalizePercent(entry.overheadPercent);
      const profitAmount = (subtotal + overheadAmount) * normalizePercent(entry.profitPercent);
      return subtotal + overheadAmount + profitAmount;
    };

    return {
      label,
      code,
      description: costCode.description || costCode.costCode?.description || "",
      groups: [
        {
          title: "Labor",
          columns: ["Classification", "ST Persons", "ST Days", "OT Persons", "OT Days", "Target Wage", "Target Pay", "Total"],
          widths: [72, 34, 34, 34, 34, 52, 56, 72],
          fontSize: 5.5,
          rowLayout: "stackedDescription",
          detailLabel: "Scope Of Work",
          rows: (costCode.laborEntries ?? []).map((entry) => ({
            cells: [
              entry.metadata?.classification || "-",
              entry.metadata?.straightTimePersons ?? "-",
              entry.metadata?.straightTimeDays ?? "-",
              entry.metadata?.overtimePersons ?? "-",
              entry.metadata?.overtimeDays ?? "-",
              entry.metadata?.targetWage ? formatPdfCurrency(entry.metadata.targetWage) : "-",
              formatPdfCurrency(entry.metadata?.targetPay || 0),
              formatPdfCurrency(entry.metadata?.finalTotal || entry.totalCost || 0),
            ],
            detail: entry.metadata?.description || entry.description || "-",
          })),
        },
        {
          title: "Subcontractor",
          columns: ["Cost", "WC %", "GL %", "Overhead %", "Profit %", "Total"],
          widths: [74, 48, 48, 58, 52, 74],
          fontSize: 5.5,
          rowLayout: "stackedDescription",
          detailLabel: "Scope Of Work",
          rows: (costCode.subcontractorEntries ?? []).map((entry) => ({
            cells: [
              formatPdfCurrency(entry.cost || 0),
              percent(entry.metadata?.workersCompPercent ?? entry.workersCompPercent),
              percent(entry.metadata?.liabilityPercent ?? entry.liabilityPercent),
              percent(entry.metadata?.overheadPercent ?? entry.overheadPercent),
              percent(entry.metadata?.profitPercent ?? entry.profitPercent),
              formatPdfCurrency(entry.metadata?.finalTotal || subcontractorTotal(entry.metadata || entry)),
            ],
            detail: entry.description || label,
          })),
        },
        {
          title: "Material",
          columns: ["Quantity", "UOM", "Waste %", "Unit Rate", "Freight", "Tax %", "Total"],
          widths: [46, 42, 42, 58, 52, 42, 82],
          fontSize: 5.5,
          rowLayout: "stackedDescription",
          detailLabel: "Description",
          rows: (costCode.materialEntries ?? []).map((entry) => ({
            cells: [
              entry.quantity || 0,
              entry.metadata?.uom || "-",
              percent(entry.wastePercent),
              formatPdfCurrency(entry.unitRate || 0),
              formatPdfCurrency(entry.freight || 0),
              percent(entry.taxPercent),
              formatPdfCurrency(entry.metadata?.finalTotal || entry.totalCost || 0),
            ],
            detail: entry.description || label,
          })),
        },
        {
          title: "Equipment",
          columns: ["Quantity", "Rental Days", "Unit Rate", "Freight", "Fuel %", "Tax %", "Total"],
          widths: [46, 58, 58, 50, 42, 42, 98],
          fontSize: 5.5,
          rowLayout: "stackedDescription",
          detailLabel: "Description",
          rows: (costCode.equipmentEntries ?? []).map((entry) => ({
            cells: [
              entry.qty || 0,
              entry.days || 0,
              formatPdfCurrency(entry.rate || 0),
              formatPdfCurrency(entry.freight || 0),
              percent(entry.metadata?.fuelPercent),
              percent(entry.taxPercent),
              formatPdfCurrency(entry.metadata?.finalTotal || entry.totalCost || 0),
            ],
            detail: entry.description || label,
          })),
        },
        {
          title: "Overhead",
          columns: ["Code", "Description", "Qty", "Rate", "Total"],
          widths: [58, 210, 78, 68, 68],
          rows: (costCode.overheadEntries ?? []).map((entry) => [
            entry.metadata?.code || "-",
            entry.description || label,
            `${entry.qty || 0} ${entry.metadata?.uom || ""}`.trim(),
            formatPdfCurrency(entry.rate || 0),
            formatPdfCurrency(entry.totalCost || 0),
          ]),
        },
      ],
    };
  });
}

function drawText(commands, text, x, y, size = 10, fillRgb = [15, 23, 42]) {
  commands.push("BT");
  commands.push(`${pdfColor(fillRgb)} rg`);
  commands.push(`/F1 ${size} Tf`);
  commands.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`);
  commands.push(`(${escapePdfText(text)}) Tj`);
  commands.push("ET");
}

function drawWrappedText(commands, text, x, y, width, size = 10, leading = 13, fillRgb = [15, 23, 42]) {
  const maxLength = Math.max(12, Math.floor(width / (size * 0.56)));
  const lines = wrapPdfLine(text, maxLength);
  lines.forEach((line, index) => {
    drawText(commands, line, x, y - index * leading, size, fillRgb);
  });
  return lines.length * leading;
}

function fitPdfCellText(value, width, size = 8) {
  const text = String(value ?? "-");
  const maxLength = Math.max(4, Math.floor(width / (size * 0.54)));
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
}

function approximatePdfTextWidth(text, size = 10) {
  return String(text ?? "").length * size * 0.52;
}

function drawRightAlignedText(commands, text, rightX, y, size = 10, fillRgb = [15, 23, 42]) {
  const safeText = String(text ?? "");
  const width = approximatePdfTextWidth(safeText, size);
  drawText(commands, safeText, rightX - width, y, size, fillRgb);
}

function drawRect(commands, x, y, width, height, fillRgb, strokeRgb = null, lineWidth = 1) {
  if (fillRgb) commands.push(`${pdfColor(fillRgb)} rg`);
  if (strokeRgb) commands.push(`${pdfColor(strokeRgb)} RG`);
  commands.push(`${lineWidth} w`);
  commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
  commands.push(fillRgb && strokeRgb ? "B" : fillRgb ? "f" : "S");
}

function estimateDocumentMeta(estimate) {
  return estimate?.summary?.documentMeta && typeof estimate.summary.documentMeta === "object"
    ? estimate.summary.documentMeta
    : {};
}


function buildPdfDocument(estimate, { documentType = "estimate" } = {}) {
  const detailsTitle = documentType === "invoice" ? "Invoice Details" : "Estimate Details";
  const meta = estimateDocumentMeta(estimate);
  const branding = {
    ...(estimate?.template?.configuration?.branding || {}),
    ...(meta.branding || {}),
  };
  const accent = [7, 32, 72];
  const ink = [15, 23, 42];
  const muted = [100, 116, 139];
  const line = [0, 0, 0];
  const page = { width: 595, height: 842, margin: 42 };
  const customer = meta.customer || {};
  const company = meta.company || {};
  const totals = meta.totals || {};
  const rows = flattenEstimateRows(estimate);
  const summary = estimate?.summary || {};
  const validUntil = meta.validUntil || "";
  const totalValue = totals.grandTotal ?? summary.finalBid ?? summary.totalPrice ?? 0;
  const pages = [];

  const customerName = customer.name || estimate?.client?.name || "Client";
  const customerAddress = customer.address || estimate?.client?.address || "";
  const customerContact = customer.contact || estimate?.client?.contact || "";
  const customerEmail = customer.email || estimate?.client?.email || "";
  const customerPhone = customer.phone || estimate?.client?.phone || "";
  const ownerName = company.signatureName || company.ownerName || "";
  const titleText = estimate?.title || meta.title || estimate?.estimate_number || "Estimate";
  const companyLines = [
    company.name || branding.companyName || "Your Company",
    company.address || "",
    [company.contactPhone, company.contactEmail].filter(Boolean).join("  |  "),
  ].filter(Boolean);

  const createPage = () => [];
  const closePage = (pageCommands) => {
    if (pageCommands.length) {
      pages.push(pageCommands.join("\n"));
    }
  };

  const drawPageHeader = (pageCommands, rightTitle, subtitle = "") => {
    const leftX = page.margin;
    const rightX = page.width - page.margin;
    const headerTop = page.height - 54;

    drawText(pageCommands, rightTitle, leftX, headerTop, 16, accent);
    if (subtitle) {
      drawText(pageCommands, subtitle, leftX, headerTop - 16, 9, muted);
    }

    drawRightAlignedText(pageCommands, companyLines[0] || "Your Company", rightX, headerTop, 16, ink);
    companyLines.slice(1).forEach((lineText, index) => {
      drawRightAlignedText(pageCommands, lineText, rightX, headerTop - 16 - index * 12, 8.5, muted);
    });

    pageCommands.push(`${pdfColor(accent)} RG`);
    pageCommands.push("1.4 w");
    pageCommands.push(`${page.margin} ${page.height - 112} m ${page.width - page.margin} ${page.height - 112} l S`);

    return page.height - 138;
  };

  let commands = createPage();
  let y = drawPageHeader(commands);

  const gap = 12;
  const availableWidth = page.width - page.margin * 2;
  const columnWidth = (availableWidth - gap) / 2;
  const boxTop = y;
  const customerAddressLines = wrapPdfLine(
    `Address: ${String(customerAddress || "-").replace(/\r?\n+/g, ", ").replace(/\s+/g, " ").trim() || "-"}`,
    42
  ).slice(0, 3);
  const customerContacts = [
    `Contact: ${customerContact || "-"}`,
    `Phone: ${customerPhone || "-"}`,
    `Email: ${customerEmail || "-"}`,
  ];
  const detailsLines = [
    `Title: ${titleText || "-"}`,
    `Estimate No: ${estimate?.estimate_number || "-"}`,
    `Date: ${formatPdfDate(estimate?.estimate_date)}`,
    `Valid Till: ${formatPdfDate(validUntil)}`,
    `Prepared By: ${ownerName || "-"}`,
  ];
  const boxLineCount = Math.max(customerContacts.length + customerAddressLines.length + 1, detailsLines.length);
  const boxHeight = 22 + boxLineCount * 12;

  drawText(commands, "Customer Details", page.margin, boxTop, 11, accent);
  drawText(commands, detailsTitle, page.margin + columnWidth + gap, boxTop, 11, accent);
  drawRect(commands, page.margin, boxTop - 14 - boxHeight, columnWidth, boxHeight, null, line, 1);
  drawRect(commands, page.margin + columnWidth + gap, boxTop - 14 - boxHeight, columnWidth, boxHeight, null, line, 1);

  const customerX = page.margin + 10;
  const detailsX = page.margin + columnWidth + gap + 10;
  let customerLineY = boxTop - 30;
  drawText(commands, `Customer: ${customerName || "-"}`, customerX, customerLineY, 8.5, ink);
  customerLineY -= 14;
  customerContacts.forEach((lineText) => {
    drawText(commands, lineText, customerX, customerLineY, 8.3, ink);
    customerLineY -= 12;
  });
  customerAddressLines.forEach((lineText) => {
    drawText(commands, lineText, customerX, customerLineY, 8.1, ink);
    customerLineY -= 11;
  });

  let detailsLineY = boxTop - 30;
  detailsLines.forEach((lineText) => {
    drawText(commands, lineText, detailsX, detailsLineY, 8.3, ink);
    detailsLineY -= 12;
  });

  y = boxTop - 24 - boxHeight;

  const tableX = page.margin;
  const tableWidth = availableWidth;
  const labelWidth = tableWidth - 120;
  const totalWidth = 120;
  const headerHeight = 24;

  drawRect(commands, tableX, y - headerHeight, labelWidth, headerHeight, null, line, 0.8);
  drawRect(commands, tableX + labelWidth, y - headerHeight, totalWidth, headerHeight, null, line, 0.8);
  drawText(commands, "Cost Code / Category", tableX + 10, y - 16, 9, ink);
  drawText(commands, "Total", tableX + labelWidth + 10, y - 16, 9, ink);
  y -= headerHeight;

  rows.forEach((row) => {
    const rowLabel = [row.code, row.label].filter(Boolean).join(" - ") || row.label || row.code || "-";
    const scopeLines = wrapPdfLine(rowLabel, 48);
    const rowHeight = Math.max(26, scopeLines.length * 10 + 10);
    drawRect(commands, tableX, y - rowHeight, labelWidth, rowHeight, null, line, 0.8);
    drawRect(commands, tableX + labelWidth, y - rowHeight, totalWidth, rowHeight, null, line, 0.8);
    scopeLines.forEach((lineText, index) => {
      drawText(commands, lineText, tableX + 10, y - 15 - index * 9, 8.3, ink);
    });
    drawRightAlignedText(commands, formatPdfCurrency(row.totalPrice || 0), tableX + tableWidth - 10, y - 15, 8.5, ink);
    y -= rowHeight;
  });

  const totalRowHeight = 28;
  drawRect(commands, tableX, y - totalRowHeight, labelWidth, totalRowHeight, null, line, 1);
  drawRect(commands, tableX + labelWidth, y - totalRowHeight, totalWidth, totalRowHeight, null, line, 1);
  drawText(commands, "Grand Total", tableX + 10, y - 17, 9, ink);
  drawRightAlignedText(commands, formatPdfCurrency(totalValue), tableX + tableWidth - 10, y - 17, 10, ink);

  closePage(commands);

  return pages;
}

function estimateToRawPdfBuffer(estimate, options = {}) {
  const pages = buildPdfDocument(estimate, options);
  const objects = [];
  const pageIds = [];
  const fontId = 3 + pages.length * 2;
  let nextId = 3;

  pages.forEach((content) => {
    const contentId = nextId;
    const pageId = nextId + 1;
    nextId += 2;

    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageIds.push(pageId);
  });

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

function decodeDataUrl(value) {
  const input = String(value || "").trim();
  if (!input.startsWith("data:")) return null;

  const commaIndex = input.indexOf(",");
  if (commaIndex === -1) return null;

  const metadata = input.slice(5, commaIndex);
  const payload = input.slice(commaIndex + 1);
  const parts = metadata.split(";");
  const mimeType = parts[0] || "text/plain";
  const isBase64 = parts.some((part) => part.toLowerCase() === "base64");

  try {
    return {
      mimeType,
      bytes: isBase64
        ? Buffer.from(payload, "base64")
        : Buffer.from(decodeURIComponent(payload), "utf8"),
    };
  } catch {
    return null;
  }
}

function isPngBytes(bytes) {
  return (
    bytes?.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isJpegBytes(bytes) {
  return bytes?.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isSvgBytes(bytes) {
  const text = Buffer.from(bytes ?? []).toString("utf8", 0, Math.min(bytes?.length ?? 0, 256)).trimStart();
  return text.startsWith("<svg") || text.startsWith("<?xml");
}

async function loadPdfImageSource(value) {
  const source = String(value || "").trim();
  if (!source) return null;

  const dataUrl = decodeDataUrl(source);
  if (dataUrl) return dataUrl;

  if (source.startsWith("<svg") || source.startsWith("<?xml")) {
    return {
      mimeType: "image/svg+xml",
      bytes: Buffer.from(source, "utf8"),
    };
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`asset_fetch_failed:${response.status}`);
  }

  const mimeType = response.headers.get("content-type") || "";
  if (mimeType.toLowerCase().includes("svg")) {
    const text = await response.text();
    return {
      mimeType,
      bytes: Buffer.from(text, "utf8"),
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    mimeType,
    bytes: Buffer.from(arrayBuffer),
  };
}

async function rasterizeSvgToPng(bytes) {
  const { default: sharp } = await import("sharp");
  return Buffer.from(await sharp(bytes).png().toBuffer());
}

async function removeLogoBackground(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Remove near-white pixels
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // White/light threshold
    if (r > 240 && g > 240 && b > 240) {
      data[i + 3] = 0; // transparent
    }
  }

  return await sharp(data, { raw: info })
    .png()
    .toBuffer();
}

async function embedPdfImage(pdfDoc, value, { removeLightBackground = false } = {}) {
  const source = await loadPdfImageSource(value).catch(() => null);
  if (!source?.bytes?.length) return null;

  const mime = source.mimeType.toLowerCase();
  if (mime.includes("svg") || isSvgBytes(source.bytes)) {
    try {
      const pngBytes = await rasterizeSvgToPng(source.bytes);
      return await pdfDoc.embedPng(pngBytes);
    } catch {
      return null;
    }
  }
  if (mime.includes("png") || isPngBytes(source.bytes)) {
    const pngBytes = removeLightBackground
      ? await removeLogoBackground(source.bytes)
      : source.bytes;
    return await pdfDoc.embedPng(pngBytes);
  }
  if (mime.includes("jpg") || mime.includes("jpeg") || isJpegBytes(source.bytes)) {
    return await pdfDoc.embedJpg(source.bytes);
  }

  try {
    return await pdfDoc.embedPng(source.bytes);
  } catch {
    try {
      return pdfDoc.embedJpg(source.bytes);
    } catch {
      return null;
    }
  }
}

export async function estimateToPdfBuffer(estimate, options = {}) {
  const baseBuffer = estimateToRawPdfBuffer(estimate, options);
  const meta = estimateDocumentMeta(estimate);
  const company = meta.company || {};
  const pdfDoc = await PDFDocument.load(baseBuffer);
  const pages = pdfDoc.getPages();
  
  if (!pages.length) {
    return Buffer.from(await pdfDoc.save());
  }
  
  const firstPage = pages[0];
  const logoImage = await embedPdfImage(pdfDoc, company.logoDataUrl, {
    removeLightBackground: true,
  });
  if (logoImage) {
    const dimensions = logoImage.scaleToFit(145, 80);
    firstPage.drawImage(logoImage, {
      x: 42,
      y: 700,
      width: 150,
      height: 150,
    });
  }

  const signatureImage = await embedPdfImage(pdfDoc, company.signatureDataUrl);
  if (signatureImage) {
    const dimensions = signatureImage.scaleToFit(180, 100);
    firstPage.drawImage(signatureImage, {
      x: 423,
      y: 72,
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  const stampImage = await embedPdfImage(pdfDoc, company.stampDataUrl);
  if (stampImage) {
    const dimensions = stampImage.scaleToFit(120, 120);
    firstPage.drawImage(stampImage, {
      x: 42,
      y: 58,
      width: dimensions.width,
      height: dimensions.height,
      opacity: 0.92,
    });
  }

  return Buffer.from(await pdfDoc.save());
}

export function normalizeTextEntries(items = []) {
  return (items ?? [])
    .map((item) => {
      if (typeof item === "string") {
        return { text: item.trim() };
      }
      return {
        text: String(item?.text || "").trim(),
      };
    })
    .filter((item) => item.text);
}

function normalizeStructuredEntries(items = [], fields = []) {
  return (items ?? [])
    .map((item) => {
      const source = typeof item === "object" && item !== null ? item : {};
      const normalized = {};

      fields.forEach((field) => {
        normalized[field] = String(source[field] || "").trim();
      });

      return normalized;
    })
    .filter((item) => fields.some((field) => item[field]));
}

export function normalizeFieldReportPayload(payload = {}) {
  const temperatureValue = String(payload.temperatureValue || "").trim();
  const temperatureUnit = String(payload.temperatureUnit || "").trim() || "F";
  const numericTemperatureValue = Number(temperatureValue);
  const hasNumericTemperatureValue = temperatureValue !== "" && Number.isFinite(numericTemperatureValue);
  const temperatureRange = hasNumericTemperatureValue
    ? `${temperatureValue} °${temperatureUnit}`
    : String(payload.temperatureRange || "").trim();

  return {
    reportDate: String(payload.reportDate || ""),
    reportTime: String(payload.reportTime || ""),
    location: String(payload.location || "").trim(),
    weatherConditions: String(payload.weatherConditions || "").trim(),
    temperatureRange,
    temperatureValue: hasNumericTemperatureValue ? temperatureValue : "",
    temperatureUnit,
    weatherImpact: String(payload.weatherImpact || "").trim(),
    publicCommunications: normalizeStructuredEntries(payload.publicCommunications, ["name", "phoneNumber", "comments"]),
    contractorLaborForce: normalizeStructuredEntries(payload.contractorLaborForce, ["classification", "personnel"]),
    subcontractorsOnsite: normalizeStructuredEntries(payload.subcontractorsOnsite, ["companyName", "supervisor", "totalPersons"]),
    equipmentUsed: normalizeStructuredEntries(payload.equipmentUsed, ["equipmentType", "makeModel", "typeOfWork", "timeInUse"]),
    materialsUsed: normalizeStructuredEntries(payload.materialsUsed, ["type", "amountUsed", "amountRemaining"]),
    workActivities: normalizeTextEntries(payload.workActivities),
    coordinationLogs: normalizeTextEntries(payload.coordinationLogs),
    comments: String(payload.comments || "").trim(),
    sitePictures: (payload.sitePictures ?? []).filter(Boolean),
    signoffName: String(payload.signoffName || "").trim(),
    signoffRole: String(payload.signoffRole || "").trim(),
  };
}

export const EXPENSE_TYPES = [
  { value: "employee_labor", label: "Employee Labor" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "material", label: "Material" },
  { value: "equipment", label: "Equipment" },
];

export const EXPENSE_STATUS_OPTIONS = [
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
];

function formatExpenseTypeLabel(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeExpenseRows(expenses = []) {
  return (expenses ?? []).map((expense, index) => ({
    id: expense?.id || `expense-${index + 1}`,
    category: String(expense?.expense_type || expense?.category || "").trim() || "Expense",
    expenseType: String(expense?.expense_type || expense?.category || "").trim() || "expense",
    projectName: String(expense?.project?.name || expense?.project_name || "").trim(),
    projectJobNumber: String(expense?.project?.job_number || "").trim(),
    partyName: String(expense?.party_name || "").trim(),
    status: String(expense?.status || "").trim(),
    amount: normalizeNumber(expense?.amount),
    quantity: normalizeNumber(expense?.quantity),
    unitRate: normalizeNumber(expense?.unit_rate),
    markupPercent: normalizeNumber(expense?.markup_percent),
    note: String(expense?.note || "").trim(),
    expenseDate: String(expense?.expense_date || expense?.expenseDate || "").trim(),
    vendor: String(expense?.vendor || "").trim(),
    paymentMethod: String(expense?.payment_method || expense?.paymentMethod || "").trim(),
    referenceNumber: String(expense?.reference_number || expense?.referenceNumber || "").trim(),
    details: expense?.details && typeof expense.details === "object" ? expense.details : {},
    createdBy: expense?.created_by?.name || expense?.created_by?.user_name || expense?.created_by?.user_code || "",
  }));
}

function buildExpensePdfPages({ project = {}, projects = [], company = {}, expenses = [], filters = {} }) {
  const accent = [7, 32, 72];
  const ink = [15, 23, 42];
  const muted = [100, 116, 139];
  const line = [0, 0, 0];
  const page = { width: 595, height: 842, margin: 42 };
  const normalizedExpenses = normalizeExpenseRows(expenses);
  const totalAmount = normalizedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const pages = [];
  const companyLines = [
    company.name || "Your Company",
    company.address || "",
    company.signatureName || "",
    [company.contactPhone, company.contactEmail].filter(Boolean).join("  "),
  ].filter(Boolean);

  let commands = [];
  let y = page.height - 168;
  let startedRows = false;

  const drawHeader = () => {
    companyLines.forEach((lineText, index) => {
      drawRightAlignedText(commands, lineText, page.width - page.margin, page.height - 58 - index * 14, index === 0 ? 16 : 9, ink);
    });
    commands.push(`${pdfColor(accent)} RG`);
    commands.push("4 w");
    commands.push(`0 ${page.height - 125} m ${page.width} ${page.height - 125} l S`);

    drawText(commands, "Expense Report", page.margin, page.height - 150, 18, accent);
    drawText(commands, `Generated: ${formatPdfDate(new Date().toISOString())}`, page.margin, page.height - 174, 9, ink);

    const filterSummary = [
      filters.startDate ? `From ${formatPdfDate(filters.startDate)}` : "",
      filters.endDate ? `To ${formatPdfDate(filters.endDate)}` : "",
      filters.expenseType && filters.expenseType !== "all" ? `Type ${formatExpenseTypeLabel(filters.expenseType)}` : "All types",
    ].filter(Boolean).join(" | ");
    drawText(commands, filterSummary || "All expenses", page.margin, page.height - 188, 9, muted);

    y = page.height - 214;
    drawRect(commands, page.margin, y - 22, 60, 22, null, line, 0.8);
    drawRect(commands, page.margin + 60, y - 22, 84, 22, null, line, 0.8);
    drawRect(commands, page.margin + 144, y - 22, 94, 22, null, line, 0.8);
    drawRect(commands, page.margin + 238, y - 22, 72, 22, null, line, 0.8);
    drawRect(commands, page.margin + 310, y - 22, 128, 22, null, line, 0.8);
    drawRect(commands, page.margin + 438, y - 22, 73, 22, null, line, 0.8);
    drawText(commands, "Date", page.margin + 8, y - 14, 8, ink);
    drawText(commands, "Project", page.margin + 68, y - 14, 8, ink);
    drawText(commands, "Type / Party", page.margin + 152, y - 14, 8, ink);
    drawText(commands, "Amount", page.margin + 246, y - 14, 8, ink);
    drawText(commands, "Note", page.margin + 318, y - 14, 8, ink);
    drawText(commands, "Entered By", page.margin + 446, y - 14, 8, ink);
    y -= 22;
  };

  const pushPage = () => {
    pages.push(commands.join("\n"));
    commands = [];
    drawHeader();
  };

  drawHeader();

  normalizedExpenses.forEach((expense, index) => {
    const detail = [expense.note, expense.vendor].filter(Boolean).join(" | ") || "-";
    const lines = wrapPdfLine(detail, 24).slice(0, 3);
    const rowHeight = Math.max(24, lines.length * 9 + 8);
    const footerReserve = 44;

    if (startedRows && y - rowHeight < page.margin + footerReserve) {
      pushPage();
    }

    startedRows = true;
    drawRect(commands, page.margin, y - rowHeight, 60, rowHeight, null, line, 0.8);
    drawRect(commands, page.margin + 60, y - rowHeight, 84, rowHeight, null, line, 0.8);
    drawRect(commands, page.margin + 144, y - rowHeight, 94, rowHeight, null, line, 0.8);
    drawRect(commands, page.margin + 238, y - rowHeight, 72, rowHeight, null, line, 0.8);
    drawRect(commands, page.margin + 310, y - rowHeight, 128, rowHeight, null, line, 0.8);
    drawRect(commands, page.margin + 438, y - rowHeight, 73, rowHeight, null, line, 0.8);

    drawText(commands, formatPdfDate(expense.expenseDate), page.margin + 8, y - 14, 7.5, ink);
    drawText(commands, fitPdfCellText(expense.projectName || "-", 78, 7.5), page.margin + 68, y - 14, 7.5, ink);
    drawText(commands, fitPdfCellText([formatExpenseTypeLabel(expense.category), expense.partyName].filter(Boolean).join(" / ") || "-", 88, 7.5), page.margin + 152, y - 14, 7.5, ink);
    drawText(commands, formatPdfCurrency(expense.amount), page.margin + 246, y - 14, 7.5, ink);
    lines.forEach((lineText, lineIndex) => {
      drawText(commands, fitPdfCellText(lineText, 122, 7.2), page.margin + 318, y - 14 - lineIndex * 8, 7.2, ink);
    });
    drawText(commands, fitPdfCellText(expense.createdBy || "-", 67, 7.5), page.margin + 446, y - 14, 7.5, ink);
    y -= rowHeight;

    if (index === normalizedExpenses.length - 1) {
      const totalHeight = 28;
      drawRect(commands, page.margin, y - totalHeight, 310, totalHeight, null, line, 1);
      drawRect(commands, page.margin + 310, y - totalHeight, 128, totalHeight, null, line, 1);
      drawRect(commands, page.margin + 438, y - totalHeight, 73, totalHeight, null, line, 1);
      drawText(commands, "Grand Total", page.margin + 318, y - 17, 9, ink);
      drawRightAlignedText(commands, formatPdfCurrency(totalAmount), page.margin + 438 + 73 - 8, y - 17, 9, ink);
      y -= totalHeight + 16;
    }
  });

  pages.push(commands.join("\n"));
  return pages;
}

function expenseReportToRawPdfBuffer(payload) {
  const pages = buildExpensePdfPages(payload);
  const objects = [];
  const pageIds = [];
  const fontId = 3 + pages.length * 2;
  let nextId = 3;

  pages.forEach((content) => {
    const contentId = nextId;
    const pageId = nextId + 1;
    nextId += 2;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageIds.push(pageId);
  });

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

export async function expenseReportToPdfBuffer(payload = {}) {
  const baseBuffer = expenseReportToRawPdfBuffer(payload);
  const pdfDoc = await PDFDocument.load(baseBuffer);
  const pages = pdfDoc.getPages();
  const company = payload.company || {};

  const logoImage = await embedPdfImage(pdfDoc, company.logoDataUrl, {
    removeLightBackground: true,
  });
  const signatureImage = await embedPdfImage(pdfDoc, company.signatureDataUrl);
  const stampImage = await embedPdfImage(pdfDoc, company.stampDataUrl);

  pages.forEach((page) => {
    if (logoImage) {
      const dimensions = logoImage.scaleToFit(220, 128);
      page.drawImage(logoImage, {
        x: 42,
        y: 700,
        width: dimensions.width,
        height: dimensions.height,
      });
    }

    if (signatureImage) {
      const dimensions = signatureImage.scaleToFit(160, 80);
      page.drawImage(signatureImage, {
        x: 392,
        y: 48,
        width: dimensions.width,
        height: dimensions.height,
      });
    }

    if (stampImage) {
      const dimensions = stampImage.scaleToFit(104, 104);
      page.drawImage(stampImage, {
        x: 42,
        y: 42,
        width: dimensions.width,
        height: dimensions.height,
        opacity: 0.92,
      });
    }
  });

  return Buffer.from(await pdfDoc.save());
}
