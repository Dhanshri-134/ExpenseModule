"use client";

import { memo } from "react";
import { BusyButton } from "@/components/dashboard/DashboardUi";

function fieldClass(extra = "") {
  return `acm-input mt-0 h-9 text-[color:var(--acm-fg)] ${extra}`.trim();
}

function areaClass(extra = "") {
  return `acm-input mt-0 min-h-[72px] py-2 text-[color:var(--acm-fg)] ${extra}`.trim();
}

function sheetFieldClass(extra = "") {
  return `w-full border-0 border-b border-[color:var(--acm-border)] bg-transparent px-1 py-2 text-sm text-[color:var(--acm-fg)] outline-none focus:border-[color:var(--acm-accent)] focus:ring-0 ${extra}`.trim();
}

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function LabeledInput({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">{label}</span>
      {children}
    </label>
  );
}

function InvoiceEditorPanelComponent({
  roleBase,
  router,
  activeEstimate,
  form,
  standalone,
  busyAction,
  clients,
  totalAmount,
  confirmDiscardChanges,
  getInvoiceTone,
  getInvoiceLabel,
  runInvoiceAction,
  downloadInvoicePdf,
  deleteInvoice,
  updateForm,
  handleClientModeChange,
  handleClientSelect,
  updateInvoiceEntry,
  removeInvoiceEntry,
  addInvoiceEntry,
  formatCurrency,
}) {
  if (!standalone) return null;

  return (
    <section className={cardClass("space-y-4 p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--acm-muted-fg)]">Invoice</div>
          <div className="mt-1 text-2xl font-bold text-[color:var(--acm-fg)]">{form?.invoiceReference || activeEstimate?.invoice_reference || "Invoice"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!confirmDiscardChanges()) return;
              router.push(`/${roleBase}/invoicing`);
            }}
            className="acm-btn acm-btn-secondary h-10 px-4"
          >
            Back
          </button>
          {activeEstimate ? (
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getInvoiceTone(activeEstimate.invoice_status)}`}>
              {getInvoiceLabel(activeEstimate.invoice_status)}
            </span>
          ) : null}
        </div>
      </div>

      {activeEstimate && form ? (
        <>
          <div className="flex flex-wrap gap-2">
            <BusyButton
              type="button"
              busy={busyAction === "save_invoice"}
              onClick={() => runInvoiceAction("save_invoice", activeEstimate.invoice_status === "not_started" ? "Invoice created." : "Invoice updated.")}
              className="acm-btn acm-btn-primary h-10 px-4"
            >
              {activeEstimate.invoice_status === "not_started" ? "Create Invoice" : "Update Invoice"}
            </BusyButton>
            <button type="button" onClick={() => downloadInvoicePdf(activeEstimate.id)} className="acm-btn acm-btn-secondary h-10 px-4">
              Download PDF
            </button>
            <BusyButton type="button" busy={busyAction === "delete"} onClick={deleteInvoice} className="acm-btn h-10 border border-rose-200 bg-rose-50 px-4 text-rose-600">
              Delete Invoice
            </BusyButton>
          </div>

          <div className="rounded-[20px] border border-[color:var(--acm-border)] bg-white p-4">
            <div className="grid grid-cols-[520px_520px] items-start justify-between gap-6 border-b border-[color:var(--acm-border)] pb-4">
              <div className="w-[520px] space-y-2">
                <input className={sheetFieldClass("text-xl font-bold")} value={form.companyName} onChange={(event) => updateForm("companyName", event.target.value)} placeholder="Company name" />
                <textarea className={sheetFieldClass("min-h-[52px] resize-none")} value={form.companyAddress} onChange={(event) => updateForm("companyAddress", event.target.value)} placeholder="Company address" />
                <div className="grid gap-2 md:grid-cols-2">
                  <input className={sheetFieldClass()} value={form.companyPhone} onChange={(event) => updateForm("companyPhone", event.target.value)} placeholder="Company phone" />
                  <input className={sheetFieldClass()} value={form.companyEmail} onChange={(event) => updateForm("companyEmail", event.target.value)} placeholder="Company email" />
                </div>
              </div>
              <div className="w-[520px] space-y-2 text-right">
                <input className={sheetFieldClass("text-right text-lg font-bold")} value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="Invoice title" />
                <div className="grid gap-2">
                  <div className="grid grid-cols-[296px_1fr] items-center gap-2">
                    <input className={sheetFieldClass("text-right")} value={form.invoiceReference} onChange={(event) => updateForm("invoiceReference", event.target.value)} placeholder="Invoice reference" />
                    <input className={sheetFieldClass("text-right w-full")} value={`#${activeEstimate.estimate_number || "-"}`} readOnly />
                  </div>
                  <div className="grid grid-cols-[96px_1fr] items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">Created At</span>
                    <input type="date" className={sheetFieldClass("text-right")} value={form.estimateDate} onChange={(event) => updateForm("estimateDate", event.target.value)} />
                  </div>
                  <div className="grid grid-cols-[96px_1fr] items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">Valid Till</span>
                    <input type="date" className={sheetFieldClass("text-right")} value={form.validUntil} onChange={(event) => updateForm("validUntil", event.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-lg font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
                  Client Details
                </div>

                <div className="ml-auto flex items-center gap-3">
                  <select
                    className={fieldClass("w-[180px] bg-white text-[color:var(--acm-fg)] py-0")}
                    value={form.clientMode}
                    onChange={(event) => handleClientModeChange(event.target.value)}
                  >
                    <option value="existing">Existing Client</option>
                    <option value="new">Create New</option>
                  </select>

                  {form.clientMode === "existing" ? (
                    <select
                      className={fieldClass("w-[220px] bg-white text-[color:var(--acm-fg)] py-0")}
                      value={form.clientId}
                      onChange={(event) => handleClientSelect(event.target.value)}
                    >
                      <option value="">Choose Client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name || client.email || "Client"}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3">
                <LabeledInput label="Client Name">
                  <input className={fieldClass()} value={form.customerName} onChange={(event) => updateForm("customerName", event.target.value)} />
                </LabeledInput>
                <LabeledInput label="Client Address">
                  <textarea className={areaClass()} value={form.customerAddress} onChange={(event) => updateForm("customerAddress", event.target.value)} />
                </LabeledInput>
                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput label="Client Phone">
                    <input className={fieldClass()} value={form.customerPhone} onChange={(event) => updateForm("customerPhone", event.target.value)} />
                  </LabeledInput>
                  <LabeledInput label="Client Email">
                    <input className={fieldClass()} value={form.customerEmail} onChange={(event) => updateForm("customerEmail", event.target.value)} />
                  </LabeledInput>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[18px] border border-[color:var(--acm-border)]">
              <div className="grid grid-cols-[1fr_160px] border-b border-[color:var(--acm-border)] bg-[color:var(--acm-surface-2)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
                <div>Scope Of Work</div>
                <div className="text-right">Total</div>
              </div>
              {(form.invoiceEntries || []).map((entry) => (
                <div key={entry.id} className="grid grid-cols-[1fr_160px_84px] items-center gap-3 border-b border-[color:var(--acm-border)] px-4 py-2 text-sm text-[color:var(--acm-fg)] last:border-b-0">
                  <input
                    className={sheetFieldClass()}
                    value={entry.scope}
                    onChange={(event) => updateInvoiceEntry(entry.id, "scope", event.target.value)}
                    placeholder="Scope of work"
                  />
                  <input
                    className={sheetFieldClass("text-right")}
                    inputMode="decimal"
                    value={entry.total}
                    onChange={(event) => updateInvoiceEntry(entry.id, "total", event.target.value)}
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => removeInvoiceEntry(entry.id)}
                    className="rounded-full border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="border-b border-[color:var(--acm-border)] px-4 py-2">
                <button type="button" onClick={addInvoiceEntry} className="acm-btn acm-btn-secondary h-9 px-4">
                  Add Entry
                </button>
              </div>
              <div className="grid grid-cols-[1fr_160px] bg-[color:var(--acm-surface-2)] px-4 py-4 text-sm font-bold text-[color:var(--acm-fg)]">
                <div>Grand Total</div>
                <div className="text-right">{formatCurrency((form.invoiceEntries || []).reduce((sum, entry) => sum + Number(entry.total || 0), 0) || totalAmount)}</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-10 text-sm text-[color:var(--acm-muted-fg)]">
          Invoice record not found.
        </div>
      )}
    </section>
  );
}

export const InvoiceEditorPanel = memo(InvoiceEditorPanelComponent);
