import { PDFDocument, rgb } from "pdf-lib";

function normalizeNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePercent(value) {
  const parsed = normalizeNumber(value);
  return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
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
  const text = String(value ?? "").trim();
  if (!text) return [""];

  const words = text.split(/\s+/);
  const lines = [];
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
  return lines;
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
  const rows = [];

  (estimate?.cost_codes ?? []).forEach((costCode, index) => {
    const groupLabel = costCode.costCode?.name || costCode.costCode?.code || `Cost Line ${index + 1}`;
    const groupCode = costCode.costCode?.code || "";
    rows.push({
      item: groupCode || `CL-${index + 1}`,
      description: costCode.description || groupLabel,
      qty: `${(costCode.laborEntries ?? []).length}/${(costCode.materialEntries ?? []).length}/${(costCode.equipmentEntries ?? []).length}/${(costCode.overheadEntries ?? []).length}`,
      rate: normalizeNumber(costCode.laborCost) + normalizeNumber(costCode.materialCost) + normalizeNumber(costCode.equipmentCost) + normalizeNumber(costCode.directOverhead),
      tax: 0,
      amount: normalizeNumber(costCode.totalCost),
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

    return {
      label,
      code,
      description: costCode.description || costCode.costCode?.description || "",
      groups: [
        {
          title: "Labour",
          columns: ["Item", "Classification", "Hours", "Rate", "Total"],
          rows: (costCode.laborEntries ?? []).map((entry) => [
            entry.metadata?.title || entry.description || "Labour",
            entry.metadata?.classification || "-",
            `${entry.stHours || 0} ST / ${entry.otHours || 0} OT`,
            `${formatPdfCurrency(entry.stRate || 0)} / ${formatPdfCurrency(entry.otRate || 0)}`,
            formatPdfCurrency(entry.totalCost || 0),
          ]),
        },
        {
          title: "Material",
          columns: ["Code", "Description", "Qty", "Rate", "Total"],
          rows: (costCode.materialEntries ?? []).map((entry) => [
            entry.metadata?.code || "-",
            entry.description || label,
            `${entry.quantity || 0} ${entry.metadata?.uom || ""}`.trim(),
            formatPdfCurrency(entry.unitRate || 0),
            formatPdfCurrency(entry.totalCost || 0),
          ]),
        },
        {
          title: "Equipment",
          columns: ["Code", "Description", "Usage", "Rate", "Total"],
          rows: (costCode.equipmentEntries ?? []).map((entry) => [
            entry.metadata?.code || "-",
            entry.description || label,
            `${entry.qty || 0} x ${entry.days || 0} days`,
            formatPdfCurrency(entry.rate || 0),
            formatPdfCurrency(entry.totalCost || 0),
          ]),
        },
        {
          title: "Overhead",
          columns: ["Code", "Description", "Qty", "Rate", "Total"],
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

function buildPdfDocument(estimate) {
  const meta = estimateDocumentMeta(estimate);
  const branding = {
    ...(estimate?.template?.configuration?.branding || {}),
    ...(meta.branding || {}),
  };
  const accent = hexToRgb(branding.accentColor, [26, 71, 145]);
  const accentSoft = accent.map((value) => Math.min(255, Math.round(value + (255 - value) * 0.86)));
  const ink = [15, 23, 42];
  const muted = [100, 116, 139];
  const white = [255, 255, 255];
  const line = [222, 229, 239];
  const page = { width: 595, height: 842, margin: 42 };
  const headerHeight = 92;
  const customer = meta.customer || {};
  const company = meta.company || {};
  const totals = meta.totals || {};
  const rows = flattenEstimateRows(estimate);
  const detailSections = buildCostLineDetailSections(estimate);
  const summary = estimate?.summary || {};
  const notes = meta.notes || estimate?.notes || "";
  const terms = meta.terms || "This estimate is valid for the period shown above and is subject to final site conditions.";
  const signatureLabel = meta.signatureLabel || "Accepted By";
  const signatureName = company.signatureName || "";
  const stampLabel = company.stampLabel || company.name || "";
  const validUntil = meta.validUntil || "";
  const pages = [];
  let commands = [];
  let y = page.height - page.margin;
  let pageIndex = 0;

  function startPage(mode = "summary") {
    commands = [];
    y = page.height - page.margin;
    pageIndex += 1;

    drawRect(commands, 0, page.height - 112, page.width, 112, accent, null);
    drawRect(commands, page.margin, page.height - 94, 48, 48, [255, 255, 255], null);
    drawText(commands, company.logoText || "ACM", page.margin + 10, page.height - 77, 16);
    drawText(commands, company.name || branding.companyName || "Your Company", page.margin + 62, page.height - 62, 18, white);
    drawText(commands, company.address || "Company address", page.margin + 62, page.height - 79, 10, white);
    drawText(commands, [company.contactPhone, company.contactEmail].filter(Boolean).join(" | ") || "Phone | Email", page.margin + 62, page.height - 94, 10, white);
    drawText(commands, estimate?.title || "Estimate", page.width - 180, page.height - 62, 18, white);
    drawText(commands, `#${estimate?.estimate_number || "Draft"}`, page.width - 180, page.height - 80, 11, white);
    drawText(commands, formatPdfDate(estimate?.estimate_date), page.width - 180, page.height - 95, 10, white);

    y = page.height - headerHeight - 40;
    if (mode === "summary") {
      drawRect(commands, page.margin, y - 104, 266, 104, [255, 255, 255], line);
      drawRect(commands, page.width - page.margin - 216, y - 104, 216, 104, [255, 255, 255], line);
      drawText(commands, "Customer Details", page.margin + 14, y - 20, 11);
      drawText(commands, customer.name || estimate?.client?.name || "Client name", page.margin + 14, y - 36, 12);
      // drawRect(commands, page.margin + 14, y - 96, 112, 18, accentSoft, line, 0.7);
      // drawRect(commands, page.margin + 136, y - 96, 116, 18, accentSoft, line, 0.7);
      drawText(commands, customer.email || estimate?.client?.email || "-", page.margin + 18, y - 89, 8);
      drawText(commands, customer.phone || estimate?.client?.contact || "-", page.margin + 140, y - 89, 8);
      drawWrappedText(commands, customer.address || estimate?.client?.address || "-", page.margin + 14, y - 50, 238, 9, 12);

      drawText(commands, "Estimate Details", page.width - page.margin - 202, y - 20, 11);
      drawText(commands, `Title: ${estimate?.title || "Estimate"}`, page.width - page.margin - 202, y - 36, 10);
      drawText(commands, `Estimate No: #${estimate?.estimate_number || "Draft"}`, page.width - page.margin - 202, y - 50, 10);
      drawText(commands, `Date: ${formatPdfDate(estimate?.estimate_date)}`, page.width - page.margin - 202, y - 64, 10);
      drawText(commands, `Valid Until: ${formatPdfDate(validUntil)}`, page.width - page.margin - 202, y - 78, 10);

      y -= 128;
      drawRect(commands, page.margin, y - 22, page.width - page.margin * 2, 22, accent, null);
      [["Code", page.margin + 10], ["Cost Line", page.margin + 112], ["Rows", 370], ["Subtotal", 420], ["Tax", 482], ["Amount", 530]].forEach(([label, x]) => {
        drawText(commands, label, x, y - 15, 9, white);
      });
      y -= 28;
    } else {
      drawRect(commands, page.margin, y - 34, page.width - page.margin * 2, 34, accentSoft, line);
      drawText(commands, "Each Cost Line Details", page.margin + 14, y - 22, 13);
      y -= 52;
    }
  }

  function closePage() {
    drawText(commands, `Prepared by ${company.preparedBy || estimate?.prepared_by?.name || "ACM"}`, page.margin, 28, 9);
    drawText(commands, `Page ${pageIndex}`, page.width - page.margin - 34, 28, 9);
    pages.push(commands.join("\n"));
  }

  startPage("summary");

  rows.forEach((row) => {
    const descriptionLines = wrapPdfLine(row.description || "-", 34);
    const rowHeight = Math.max(18, descriptionLines.length * 12 + 8);
    if (y - rowHeight < 180) {
      closePage();
      startPage();
    }

    drawRect(commands, page.margin, y - rowHeight + 4, page.width - page.margin * 2, rowHeight, [255, 255, 255], line, 0.6);
    drawText(commands, row.item || "-", page.margin + 10, y - 12, 9);
    descriptionLines.forEach((lineText, index) => {
      drawText(commands, lineText, page.margin + 112, y - 12 - index * 11, 9);
    });
    drawText(commands, String(row.qty || 0), 370, y - 12, 9);
    drawText(commands, formatPdfCurrency(row.rate || 0), 412, y - 12, 9);
    drawText(commands, `${normalizeNumber(row.tax).toFixed(1)}%`, 485, y - 12, 9);
    drawText(commands, formatPdfCurrency(row.amount || 0), 516, y - 12, 9);
    y -= rowHeight;
  });

  if (y < 230) {
    closePage();
    startPage();
  }

  const totalsX = page.width - page.margin - 202;
  drawRect(commands, totalsX, y - 110, 202, 110, accentSoft, line);
  drawText(commands, "Summary", totalsX + 14, y - 18, 12);
  [
    ["Subtotal", totals.subtotal ?? summary.baseCost ?? 0],
    ["Discount", totals.discountAmount ?? 0],
    ["Tax", totals.taxAmount ?? 0],
    ["Additional Charges", totals.additionalCharges ?? 0],
    ["Total", totals.grandTotal ?? summary.finalBid ?? summary.totalPrice ?? 0],
  ].forEach(([label, value], index) => {
    const rowY = y - 40 - index * 16;
    drawText(commands, label, totalsX + 14, rowY, 10);
    drawText(commands, formatPdfCurrency(value), totalsX + 124, rowY, index === 4 ? 11 : 10);
  });

  drawRect(commands, page.margin, y - 110, 270, 110, [255, 255, 255], line);
  drawText(commands, "Notes", page.margin + 14, y - 18, 11);
  drawWrappedText(commands, notes || "Thank you for the opportunity to provide this estimate.", page.margin + 14, y - 36, 240, 9, 12);

  y -= 134;
  drawRect(commands, page.margin, y - 82, page.width - page.margin * 2, 82, [255, 255, 255], line);
  drawText(commands, "Terms", page.margin + 14, y - 18, 11);
  drawWrappedText(commands, terms, page.margin + 14, y - 36, page.width - page.margin * 2 - 28, 9, 12);

  y -= 102;
  
  // commands.push(`${pdfColor(muted)} RG`);
  // commands.push("1 w");
  // commands.push(`${page.margin} ${y - 18} m ${page.margin + 210} ${y - 18} l S`);
  // if (stampLabel) {
  //   drawRect(commands, page.width - 150, y - 42, 110, 40, null, accent, 1);

  // drawText(
  //   commands,
  //   stampLabel.slice(0, 22),
  //   page.width - 138,
  //   y - 24,
  //   9
  // );  }
  // drawText(commands, "Date", page.margin + 290, y, 10);
  // commands.push(`${page.margin + 290} ${y - 18} m ${page.margin + 430} ${y - 18} l S`);

  closePage();

  detailSections.forEach((section) => {
    startPage("detail");
    drawText(commands, `${section.code ? `${section.code} - ` : ""}${section.label}`, page.margin, y, 14);
    if (section.description) {
      y -= 18;
      drawWrappedText(commands, section.description, page.margin, y, page.width - page.margin * 2, 9, 12);
      y -= 12;
    }
    y -= 18;

    section.groups.forEach((group) => {
      if (!group.rows.length) return;
      if (y < 120) {
        closePage();
        startPage("detail");
      }

      drawRect(commands, page.margin, y - 20, page.width - page.margin * 2, 20, accent, null);
      drawText(commands, group.title, page.margin + 10, y - 13, 9, white);
      y -= 24;
      drawRect(commands, page.margin, y - 18, page.width - page.margin * 2, 18, accentSoft, line);
      group.columns.forEach((column, index) => {
        drawText(commands, column, page.margin + 8 + index * 100, y - 12, 8);
      });
      y -= 22;

      group.rows.forEach((row) => {
        if (y < 100) {
          closePage();
          startPage("detail");
        }
        drawRect(commands, page.margin, y - 18, page.width - page.margin * 2, 18, [255, 255, 255], line, 0.5);
        row.forEach((cell, index) => {
          drawText(commands, String(cell || "-"), page.margin + 8 + index * 100, y - 12, 8);
        });
        y -= 20;
      });

      y -= 8;
    });

    closePage();
  });
  return pages;
}

function estimateToRawPdfBuffer(estimate) {
  const pages = buildPdfDocument(estimate);
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
  const match = String(value || "").match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
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

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`asset_fetch_failed:${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    mimeType: response.headers.get("content-type") || "",
    bytes: Buffer.from(arrayBuffer),
  };
}

async function rasterizeSvgToPng(bytes) {
  const { default: sharp } = await import("sharp");
  return Buffer.from(await sharp(bytes).png().toBuffer());
}

async function embedPdfImage(pdfDoc, value) {
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
    return await pdfDoc.embedPng(source.bytes);
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

export async function estimateToPdfBuffer(estimate) {
  const baseBuffer = estimateToRawPdfBuffer(estimate);
  const meta = estimateDocumentMeta(estimate);
  const company = meta.company || {};
  const pdfDoc = await PDFDocument.load(baseBuffer);
  const pages = pdfDoc.getPages();
  
  if (!pages.length) {
    return Buffer.from(await pdfDoc.save());
  }
  
  const firstPage = pages[0];
  const logoImage = await embedPdfImage(pdfDoc, company.logoDataUrl);
  if (logoImage) {
  pages.forEach((page) => {
    page.drawRectangle({
      x: 42,
      y: 748,
      width: 48,
      height: 48,
      color: rgb(1, 1, 1),
    });

    const dimensions = logoImage.scaleToFit(42, 42);

    page.drawImage(logoImage, {
      x: 45,
      y: 751 + (42 - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height,
    });
  });
}

  const signatureImage = await embedPdfImage(pdfDoc, company.signatureDataUrl);
  if (signatureImage) {
    firstPage.drawRectangle({
      x: 48,
      y: 105,
      width: 180,
      height: 28,
      color: rgb(1, 1, 1),
    });
    const dimensions = signatureImage.scaleToFit(160, 44);
    firstPage.drawImage(signatureImage, {
      x: 54,
      y: 106 + (44 - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height,
    });
  }

const stampImage = await embedPdfImage(pdfDoc, company.stampDataUrl);

if (stampImage) {
  const firstPage = pages[0];

  const dimensions = stampImage.scaleToFit(90, 90);

  firstPage.drawImage(stampImage, {
    x: 470,
    y: 40,
    width: dimensions.width,
    height: dimensions.height,
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
  const temperatureRange = temperatureValue ? `${temperatureValue} °${temperatureUnit}` : String(payload.temperatureRange || "").trim();

  return {
    reportDate: String(payload.reportDate || ""),
    reportTime: String(payload.reportTime || ""),
    location: String(payload.location || "").trim(),
    weatherConditions: String(payload.weatherConditions || "").trim(),
    temperatureRange,
    temperatureValue,
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
