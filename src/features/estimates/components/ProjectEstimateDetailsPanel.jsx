"use client";

import { memo } from "react";

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[color:var(--acm-border)] py-2 text-sm last:border-b-0">
      <div className="font-semibold text-[color:var(--acm-muted-fg)]">{label}</div>
      <div className="text-[color:var(--acm-fg)]">{value || "-"}</div>
    </div>
  );
}

function ProjectEstimateDetailsPanelComponent({
  selectedEstimate,
  canManage,
  exportEstimate,
  openEdit,
  deleteEstimate,
  buildEstimateTitle,
  formatDate,
  formatCurrency,
  previewSummary,
  EstimateSummaryCard,
}) {
  if (!selectedEstimate) return null;

  return (
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
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
            <div>Labor: {formatCurrency(line.laborCost)}</div>
            <div>Subcontractor: {formatCurrency(line.subcontractorCost)}</div>
            <div>Material: {formatCurrency(line.materialCost)}</div>
            <div>Equipment: {formatCurrency(line.equipmentCost)}</div>
            <div>Overhead: {formatCurrency(line.directOverhead)}</div>
          </div>
        </div>
      ))}

      <EstimateSummaryCard summary={selectedEstimate.summary || previewSummary} />
    </div>
  );
}

export const ProjectEstimateDetailsPanel = memo(ProjectEstimateDetailsPanelComponent);
