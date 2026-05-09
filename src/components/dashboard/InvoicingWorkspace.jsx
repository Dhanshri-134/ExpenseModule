"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BusyButton, CompactListRow } from "@/components/dashboard/DashboardUi";
import { useApiQuery, invalidateApiQuery } from "@/lib/client/apiQuery";

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function fieldClass() {
  return "acm-input mt-0";
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function getInvoiceAmount(estimate) {
  return Number(estimate?.summary?.finalBid || estimate?.summary?.totalPrice || 0);
}

function getInvoiceTone(status) {
  if (status === "completed") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  if (status === "draft") return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  return "border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] text-[color:var(--acm-muted-fg)]";
}

function getInvoiceLabel(status) {
  if (status === "completed") return "Completed";
  if (status === "draft") return "Draft";
  return "Not Started";
}

function getInvoiceErrorMessage(error) {
  if (!error) return "";
  if (error === "estimate_not_found") return "This estimate could not be found anymore.";
  if (error === "estimate_workflow_update_failed") return "Unable to update the invoice stage right now.";
  return error;
}

function MetricCard({ label, value, helper }) {
  return (
    <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">{label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-[color:var(--acm-fg)]">{value}</div>
      {helper ? <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">{helper}</div> : null}
    </div>
  );
}

function InlineMessage({ error, message }) {
  if (!error && !message) return null;
  return (
    <div className={error ? "acm-message-error" : "acm-message-success"}>
      {error || message}
    </div>
  );
}

export function InvoicingWorkspace({ roleBase = "owner" }) {
  const estimatesQuery = useApiQuery("/api/estimates");
  const settingsQuery = useApiQuery("/api/settings");
  const [activeEstimateId, setActiveEstimateId] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const invoiceCandidates = useMemo(() => {
    const rows = estimatesQuery.data?.estimates || [];
    return rows.filter((estimate) => {
      const approvalStatus = String(estimate.approval_status || estimate.approvalStatus || "");
      const status = String(estimate.status || "");
      return approvalStatus === "approved" || status === "approved" || estimate.invoice_status === "draft" || estimate.invoice_status === "completed";
    });
  }, [estimatesQuery.data?.estimates]);

  const activeEstimate = useMemo(
    () => invoiceCandidates.find((estimate) => estimate.id === activeEstimateId) || invoiceCandidates[0] || null,
    [activeEstimateId, invoiceCandidates]
  );
  const effectiveInvoiceReference = invoiceReference || activeEstimate?.invoice_reference || "";

  const metrics = useMemo(() => {
    const draft = invoiceCandidates.filter((estimate) => estimate.invoice_status === "draft");
    const completed = invoiceCandidates.filter((estimate) => estimate.invoice_status === "completed");
    const ready = invoiceCandidates.filter((estimate) => !estimate.invoice_status || estimate.invoice_status === "not_started");
    const totalValue = invoiceCandidates.reduce((sum, estimate) => sum + getInvoiceAmount(estimate), 0);

    return {
      total: invoiceCandidates.length,
      ready: ready.length,
      draft: draft.length,
      completed: completed.length,
      totalValue,
    };
  }, [invoiceCandidates]);

  async function runInvoiceAction(action, body, successMessage) {
    setBusyAction(action);
    setError("");
    setMessage("");
    const res = await fetch("/api/estimate-workflow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    setBusyAction("");

    if (!res.ok) {
      setError(getInvoiceErrorMessage(json?.error || "invoice_action_failed"));
      return false;
    }

    invalidateApiQuery("/api/estimates");
    await estimatesQuery.refresh().catch(() => null);
    setMessage(successMessage);
    return true;
  }

  async function markDraft() {
    if (!activeEstimate) return;
    await runInvoiceAction(
      "draft",
      {
        estimateId: activeEstimate.id,
        action: "mark_invoice_ready",
        invoiceReference: effectiveInvoiceReference.trim() || null,
      },
      "Invoice moved to draft."
    );
  }

  const company = settingsQuery.data?.company;

  return (
    <div className="space-y-6">
      <section className={cardClass()}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">Invoices</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[color:var(--acm-fg)]">Invoice control</h1>
            {/* <div className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--acm-muted-fg)]">
              Approved estimates now move through invoice draft and completed stages here, instead of landing on a placeholder screen.
            </div> */}
          </div>
          <Link href={`/${roleBase}/estimates`} className="acm-btn acm-btn-secondary h-10 px-4">
            Open Estimates
          </Link>
        </div>
      </section>

      <InlineMessage error={estimatesQuery.error || settingsQuery.error || error} message={message} />

      <section className="hidden sm:flex grid gap-4 md:grid-cols-2 xl:grid-cols-5 ">
        <MetricCard label="Approved Estimates" value={metrics.total} helper="Ready to invoice" />
        <MetricCard label="Not Started" value={metrics.ready} helper="Awaiting draft invoice" />
        <MetricCard label="Draft Invoices" value={metrics.draft} helper="Saved invoice references" />
        <MetricCard label="Completed" value={metrics.completed} helper="Previously completed" />
        <MetricCard label="Invoice Value" value={formatCurrency(metrics.totalValue)} helper="Current visible pipeline" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className={cardClass()}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xl font-bold text-[color:var(--acm-fg)]">Invoice Queue</div>
              <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">Approved estimates waiting for invoice actions.</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {invoiceCandidates.length ? invoiceCandidates.map((estimate) => (
              <CompactListRow
                key={estimate.id}
                primary={estimate.title || `Estimate #${estimate.estimate_number}`}
                secondary={`${estimate.client?.name || "Client"} | ${formatDate(estimate.estimate_date)}`}
                tertiary={`${formatCurrency(getInvoiceAmount(estimate))} | Ref ${estimate.invoice_reference || "Pending"}`}
                onClick={() => {
                  setActiveEstimateId(estimate.id);
                  setInvoiceReference(estimate.invoice_reference || "");
                  setMessage("");
                  setError("");
                }}
                actions={
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getInvoiceTone(estimate.invoice_status)}`}>
                    {getInvoiceLabel(estimate.invoice_status)}
                  </span>
                }
              />
            )) : (
              <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-8 text-sm text-[color:var(--acm-muted-fg)]">
                No approved estimates are ready for invoicing yet.
              </div>
            )}
          </div>
        </div>

        <div className={cardClass()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xl font-bold text-[color:var(--acm-fg)]">Invoice Builder</div>
              <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">Save the invoice reference against an approved estimate.</div>
            </div>
            {activeEstimate ? (
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getInvoiceTone(activeEstimate.invoice_status)}`}>
                {getInvoiceLabel(activeEstimate.invoice_status)}
              </span>
            ) : null}
          </div>

          {activeEstimate ? (
            <div className="mt-5 grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">Bill To</div>
                  <div className="mt-3 text-lg font-bold text-[color:var(--acm-fg)]">{activeEstimate.client?.name || "Client"}</div>
                  <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">{activeEstimate.client?.contact || activeEstimate.customer_name || "-"}</div>
                  <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">{activeEstimate.client?.email || activeEstimate.customer_email || "-"}</div>
                  <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">{activeEstimate.client?.address || activeEstimate.customer_address || "-"}</div>
                </div>

                <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">From Company</div>
                  <div className="mt-3 text-lg font-bold text-[color:var(--acm-fg)]">{company?.name || "Company profile pending"}</div>
                  <div className="mt-2 text-sm text-[color:var(--acm-muted-fg)]">{company?.contact || "-"}</div>
                  <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">{company?.email || "-"}</div>
                  <div className="mt-1 text-sm text-[color:var(--acm-muted-fg)]">{company?.address || "-"}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">Estimate</div>
                  <div className="mt-2 text-lg font-bold text-[color:var(--acm-fg)]">#{activeEstimate.estimate_number || "-"}</div>
                </div>
                <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">Invoice Value</div>
                  <div className="mt-2 text-lg font-bold text-[color:var(--acm-fg)]">{formatCurrency(getInvoiceAmount(activeEstimate))}</div>
                </div>
                <div className="rounded-[18px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">Approved On</div>
                  <div className="mt-2 text-lg font-bold text-[color:var(--acm-fg)]">{formatDate(activeEstimate.approved_at)}</div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[color:var(--acm-fg)]">Invoice Reference</label>
                <input
                  className={fieldClass()}
                  placeholder="QB-INV-1001"
                  value={effectiveInvoiceReference}
                  onChange={(event) => setInvoiceReference(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <BusyButton type="button" busy={busyAction === "draft"} onClick={markDraft} className="acm-btn acm-btn-primary h-10 px-4">
                  Create Invoice
                </BusyButton>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-10 text-sm text-[color:var(--acm-muted-fg)]">
              Pick an approved estimate from the queue to build its invoice.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
