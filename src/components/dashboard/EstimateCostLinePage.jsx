"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useApiQuery } from "@/lib/client/apiQuery";

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function DataTable({ title, columns, rows }) {
  return (
    <section className={cardClass()}>
      <div className="mb-4 text-lg font-bold text-[color:var(--acm-fg)]">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[18px] border border-[color:var(--acm-border)]">
          <thead>
            <tr className="bg-[color:var(--acm-surface-2)] text-left text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, rowIndex) => (
              <tr key={row.id || `${title}-${rowIndex}`} className="text-sm text-[color:var(--acm-fg)]">
                {columns.map((column) => (
                  <td key={column.key} className="border-t border-[color:var(--acm-border)] px-4 py-3 align-top">
                    {column.render ? column.render(row) : row[column.key] || "-"}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length} className="border-t border-[color:var(--acm-border)] px-4 py-6 text-sm text-[color:var(--acm-muted-fg)]">
                  No rows added.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function EstimateCostLinePage({ roleBase = "owner", estimateId, costLineId }) {
  const estimateQuery = useApiQuery(estimateId ? `/api/estimates?id=${estimateId}` : null);
  const settingsQuery = useApiQuery("/api/settings");
  const estimate = estimateQuery.data?.estimates?.[0] || null;
  const costLine = useMemo(
    () => estimate?.cost_codes?.find((item) => item.id === costLineId) || null,
    [costLineId, estimate?.cost_codes]
  );

  const company = settingsQuery.data?.company || null;

  return (
    <div className="space-y-6">
      <section className={cardClass()}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">Cost Line Details</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[color:var(--acm-fg)]">
              {costLine?.costCode?.name || costLine?.costCode?.code || "Cost Line"}
            </h1>
            <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">
              {costLine?.description || estimate?.title || "Estimate cost line breakdown"}
            </div>
          </div>
          <Link href={`/${roleBase}/estimates`} className="acm-btn acm-btn-secondary h-10 px-4">
            Back to Estimates
          </Link>
        </div>
      </section>

      {(estimateQuery.loading || settingsQuery.loading) ? (
        <div className={cardClass("text-sm text-[color:var(--acm-muted-fg)]")}>Loading cost line details...</div>
      ) : null}

      {estimateQuery.error ? <div className="acm-message-error">{estimateQuery.error}</div> : null}

      {costLine ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className={cardClass()}><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">Labor</div><div className="mt-2 text-2xl font-bold">{formatCurrency(costLine.laborCost)}</div></div>
            <div className={cardClass()}><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">Material</div><div className="mt-2 text-2xl font-bold">{formatCurrency(costLine.materialCost)}</div></div>
            <div className={cardClass()}><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">Equipment</div><div className="mt-2 text-2xl font-bold">{formatCurrency(costLine.equipmentCost)}</div></div>
            <div className={cardClass()}><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">Overhead</div><div className="mt-2 text-2xl font-bold">{formatCurrency(costLine.directOverhead)}</div></div>
            <div className={cardClass()}><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">Total</div><div className="mt-2 text-2xl font-bold">{formatCurrency(costLine.totalCost)}</div></div>
          </section>

          <DataTable
            title="Labor"
            columns={[
              { key: "description", label: "Item" },
              { key: "classification", label: "Classification", render: (row) => row.metadata?.classification || "-" },
              { key: "hours", label: "Hours", render: (row) => `${row.stHours || 0} ST / ${row.otHours || 0} OT` },
              { key: "rate", label: "Rate", render: (row) => `${formatCurrency(row.stRate)} / ${formatCurrency(row.otRate)}` },
              { key: "total", label: "Total", render: (row) => formatCurrency(row.totalCost) },
            ]}
            rows={costLine.laborEntries || []}
          />

          <DataTable
            title="Material"
            columns={[
              { key: "code", label: "Code", render: (row) => row.metadata?.code || "-" },
              { key: "description", label: "Description" },
              { key: "quantity", label: "Quantity", render: (row) => `${row.quantity || 0} ${row.metadata?.uom || ""}`.trim() },
              { key: "rate", label: "Rate", render: (row) => formatCurrency(row.unitRate) },
              { key: "freight", label: "Freight", render: (row) => formatCurrency(row.freight) },
              { key: "total", label: "Total", render: (row) => formatCurrency(row.totalCost) },
            ]}
            rows={costLine.materialEntries || []}
          />

          <DataTable
            title="Equipment"
            columns={[
              { key: "code", label: "Code", render: (row) => row.metadata?.code || "-" },
              { key: "description", label: "Description" },
              { key: "usage", label: "Usage", render: (row) => `${row.qty || 0} x ${row.days || 0} days` },
              { key: "rate", label: "Rate", render: (row) => formatCurrency(row.rate) },
              { key: "fuel", label: "Fuel", render: (row) => formatCurrency(row.fuel) },
              { key: "total", label: "Total", render: (row) => formatCurrency(row.totalCost) },
            ]}
            rows={costLine.equipmentEntries || []}
          />

          <DataTable
            title="Overhead"
            columns={[
              { key: "code", label: "Code", render: (row) => row.metadata?.code || "-" },
              { key: "description", label: "Description" },
              { key: "quantity", label: "Quantity", render: (row) => `${row.qty || 0} ${row.metadata?.uom || ""}`.trim() },
              { key: "days", label: "Days", render: (row) => row.days || 0 },
              { key: "rate", label: "Rate", render: (row) => formatCurrency(row.rate) },
              { key: "total", label: "Total", render: (row) => formatCurrency(row.totalCost) },
            ]}
            rows={costLine.overheadEntries || []}
          />

          <section className={cardClass()}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-[color:var(--acm-muted-fg)]">Signature</div>
                <div className="mt-3 rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                  {company?.signatureDataUrl ? <img src={company.signatureDataUrl} alt="Signature" className="h-24 w-full object-contain" /> : <div className="text-sm text-[color:var(--acm-muted-fg)]">{company?.signatureName || "No signature set"}</div>}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-[color:var(--acm-muted-fg)]">Stamp</div>
                <div className="mt-3 rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                  {company?.stampDataUrl ? <img src={company.stampDataUrl} alt="Stamp" className="h-24 w-full object-contain" /> : <div className="text-sm text-[color:var(--acm-muted-fg)]">{company?.stampLabel || "No stamp set"}</div>}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
