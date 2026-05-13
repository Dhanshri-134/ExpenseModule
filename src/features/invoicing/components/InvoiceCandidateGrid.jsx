"use client";

import { memo } from "react";
import { CompactListRow } from "@/components/dashboard/DashboardUi";

function InvoiceCandidateGridComponent({
  estimates,
  roleBase,
  router,
  formatDate,
  formatCurrency,
  getInvoiceAmount,
  getInvoiceTone,
  getInvoiceLabel,
}) {
  if (!estimates.length) {
    return (
      <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-8 text-sm text-[color:var(--acm-muted-fg)] lg:col-span-3">
        No invoices match the current search.
      </div>
    );
  }

  return estimates.map((estimate) => (
    <CompactListRow
      key={estimate.id}
      primary={estimate.title || `Estimate #${estimate.estimate_number}`}
      secondary={`${estimate.client?.name || "Client"} | ${formatDate(estimate.estimate_date)}`}
      tertiary={`${formatCurrency(getInvoiceAmount(estimate))} | Ref: ${estimate.invoice_reference || "Pending"}`}
      onClick={() => router.push(`/${roleBase}/invoicing/${estimate.id}`)}
      actions={(
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getInvoiceTone(estimate.invoice_status)}`}>
            {getInvoiceLabel(estimate.invoice_status)}
          </span>
        </div>
      )}
    />
  ));
}

export const InvoiceCandidateGrid = memo(InvoiceCandidateGridComponent);
