"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BusyButton, CompactListRow } from "@/components/dashboard/DashboardUi";
import { sendJson } from "@/lib/client/apiClient";
import { useApiQuery, invalidateApiQuery } from "@/lib/client/apiQuery";

function cardClass(extra = "") {
  return `rounded-[22px] border border-[color:var(--acm-border)] bg-[color:var(--acm-surface)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)] ${extra}`.trim();
}

function fieldClass(extra = "") {
  return `acm-input mt-0 h-9 text-[color:var(--acm-fg)] ${extra}`.trim();
}

function areaClass(extra = "") {
  return `acm-input mt-0 min-h-[72px] py-2 text-[color:var(--acm-fg)] ${extra}`.trim();
}

function sheetFieldClass(extra = "") {
  return `w-full border-0 border-b border-[color:var(--acm-border)] bg-transparent px-1 py-2 text-sm text-[color:var(--acm-fg)] outline-none focus:border-[color:var(--acm-accent)] focus:ring-0 ${extra}`.trim();
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

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
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
  if (error === "estimate_workflow_update_failed") return "Unable to update the invoice right now.";
  if (error === "client_create_failed") return "Unable to create the client right now.";
  return error;
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

function invoiceRowsFromEstimate(estimate) {
  const storedEntries = estimate?.summary?.documentMeta?.invoice?.entries;
  if (Array.isArray(storedEntries) && storedEntries.length) {
    return storedEntries.map((row, index) => ({
      id: row.id || `row-${index + 1}`,
      label: row.scope || `Entry ${index + 1}`,
      amount: Number(row.total || 0),
    }));
  }

  const costCodeRows = (estimate?.cost_codes ?? []).map((row, index) => ({
    id: row.id || `row-${index + 1}`,
    label: row.costCode?.name || row.costCode?.code || row.description || `Cost Code ${index + 1}`,
    amount: Number(row.totalPrice || row.totalCost || 0),
  }));

  if (costCodeRows.length) return costCodeRows;

  const lineRows = (estimate?.line_items ?? []).map((row, index) => ({
    id: row.id || `row-${index + 1}`,
    label: row.costCode || row.scope || row.description || `Line ${index + 1}`,
    amount: Number(row.totalCost || row.amount || row.laborCost || 0),
  }));

  if (lineRows.length) return lineRows;

  return [
    {
      id: "total",
      label: estimate?.title || "Invoice",
      amount: getInvoiceAmount(estimate),
    },
  ];
}

function buildInvoiceForm(estimate, company) {
  const meta = estimate?.summary?.documentMeta || {};
  const customer = meta.customer || {};
  const invoiceMeta = meta.invoice || {};
  const companyMeta = meta.company || {};
  const today = new Date().toISOString().slice(0, 10);

  return {
    clientMode: estimate?.client_id ? "existing" : "new",
    clientId: estimate?.client_id || "",
    title: estimate?.title || "Invoice",
    estimateDate: estimate?.estimate_date || today,
    validUntil: meta.validUntil || estimate?.estimate_date || today,
    customerName: customer.name || estimate?.client?.name || "",
    customerAddress: customer.address || estimate?.client?.address || "",
    customerEmail: customer.email || estimate?.client?.email || "",
    customerPhone: customer.phone || estimate?.client?.contact || "",
    companyName: companyMeta.name || company?.name || "",
    companyAddress: companyMeta.address || company?.address || "",
    companyEmail: companyMeta.contactEmail || company?.email || "",
    companyPhone: companyMeta.contactPhone || company?.contact || "",
    invoiceReference: invoiceMeta.invoiceReference || estimate?.invoice_reference || "",
    invoiceScopeOfWork: invoiceMeta.scopeOfWork || "",
    invoiceTotalCode: invoiceMeta.totalCode || "",
    invoiceEntries: invoiceRowsFromEstimate(estimate).map((entry, index) => ({
      id: entry.id || `entry-${index + 1}`,
      scope: entry.label || "",
      total: String(Number(entry.amount || 0)),
    })),
  };
}

function createInvoiceEntry(index = 1) {
  return {
    id: `entry-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    scope: "",
    total: "",
  };
}

function InlineMessage({ error, message }) {
  if (!error && !message) return null;
  return (
    <div className={error ? "acm-message-error" : "acm-message-success"}>
      {error || message}
    </div>
  );
}

function downloadInvoicePdf(estimateId) {
  if (!estimateId) return;
  const url = `/api/estimates?id=${estimateId}&export=pdf&document=invoice&disposition=attachment`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function LabeledInput({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">{label}</span>
      {children}
    </label>
  );
}

export function InvoicingWorkspace({ roleBase = "owner", initialEstimateId = "", standalone = false }) {
  const router = useRouter();
  const estimatesQuery = useApiQuery(
    standalone && initialEstimateId ? `/api/estimates?id=${initialEstimateId}` : "/api/estimates?compact=1"
  );
  const settingsQuery = useApiQuery("/api/settings");
  const clientsQuery = useApiQuery("/api/clients");
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dirty, setDirty] = useState(false);

  const rows = useMemo(() => estimatesQuery.data?.estimates || [], [estimatesQuery.data?.estimates]);
  const company = settingsQuery.data?.company || null;
  const clients = useMemo(() => clientsQuery.data?.clients || [], [clientsQuery.data?.clients]);

  const invoiceCandidates = useMemo(() => {
    if (standalone) return rows;
    return rows.filter((estimate) => {
      const approvalStatus = String(estimate.approval_status || estimate.approvalStatus || "");
      const status = String(estimate.status || "");
      return approvalStatus === "approved" || status === "approved" || estimate.invoice_status === "draft" || estimate.invoice_status === "completed";
    });
  }, [rows, standalone]);

  const filteredInvoiceCandidates = useMemo(
    () =>
      invoiceCandidates.filter((estimate) =>
        matchesSearchQuery(
          searchQuery,
          estimate.title,
          estimate.estimate_number,
          estimate.client?.name,
          estimate.invoice_reference,
          estimate.invoice_status,
          estimate.summary?.finalBid,
          estimate.summary?.totalPrice
        )
      ),
    [invoiceCandidates, searchQuery]
  );

  const activeEstimate = useMemo(() => {
    if (standalone) return rows.find((estimate) => estimate.id === initialEstimateId) || rows[0] || null;
    return filteredInvoiceCandidates[0] || null;
  }, [filteredInvoiceCandidates, initialEstimateId, rows, standalone]);

  useEffect(() => {
    if (!activeEstimate || !company) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(buildInvoiceForm(activeEstimate, company));
    setDirty(false);
  }, [activeEstimate, company]);


  useEffect(() => {
    if (!dirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function confirmDiscardChanges() {
    if (!dirty) return true;
    return window.confirm("You have unsaved invoice changes. Discard them?");
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...(current || {}), [key]: value }));
    setDirty(true);
  }

  function updateInvoiceEntry(entryId, key, value) {
    setForm((current) => ({
      ...(current || {}),
      invoiceEntries: (current?.invoiceEntries || []).map((entry) => (entry.id === entryId ? { ...entry, [key]: value } : entry)),
    }));
    setDirty(true);
  }

  function addInvoiceEntry() {
    setForm((current) => ({
      ...(current || {}),
      invoiceEntries: [...(current?.invoiceEntries || []), createInvoiceEntry((current?.invoiceEntries || []).length + 1)],
    }));
    setDirty(true);
  }

  function removeInvoiceEntry(entryId) {
    setForm((current) => ({
      ...(current || {}),
      invoiceEntries:
        (current?.invoiceEntries || []).length > 1
          ? (current?.invoiceEntries || []).filter((entry) => entry.id !== entryId)
          : current?.invoiceEntries || [],
    }));
    setDirty(true);
  }

  function handleClientModeChange(nextMode) {
    setForm((current) => ({
      ...(current || {}),
      clientMode: nextMode,
      clientId: nextMode === "existing" ? current?.clientId || "" : "",
      ...(nextMode === "new"
        ? {}
        : (() => {
            const client = clients.find((item) => item.id === current?.clientId);
            return client
              ? {
                  customerName: client.name || "",
                  customerAddress: client.address || "",
                  customerEmail: client.email || "",
                  customerPhone: client.contact || "",
                }
              : {};
          })()),
    }));
    setDirty(true);
  }

  function handleClientSelect(clientId) {
    const client = clients.find((item) => item.id === clientId);
    setForm((current) => ({
      ...(current || {}),
      clientMode: "existing",
      clientId,
      customerName: client?.name || "",
      customerAddress: client?.address || "",
      customerEmail: client?.email || "",
      customerPhone: client?.contact || "",
    }));
    setDirty(true);
  }

  function validateInvoice() {
    if (!activeEstimate) return "Pick an estimate first.";
    if (!form?.title?.trim()) return "Invoice title is required.";
    if (!form?.estimateDate) return "Invoice date is required.";
    if (!form?.validUntil) return "Valid until date is required.";
    if (!form?.invoiceReference?.trim()) return "Invoice reference is required.";
    if (form.clientMode === "existing" && !form.clientId) return "Select an existing client.";
    if (!form?.customerName?.trim()) return "Client name is required.";
    if (!form?.customerAddress?.trim()) return "Client address is required.";
    if (!isValidEmail(form?.customerEmail)) return "Enter a valid client email.";
    if (!form?.customerPhone?.trim()) return "Client phone is required.";
    if (!form?.companyName?.trim()) return "Company name is required.";
    if (!form?.companyAddress?.trim()) return "Company address is required.";
    if (!isValidEmail(form?.companyEmail)) return "Enter a valid company email.";
    if (!form?.companyPhone?.trim()) return "Company phone is required.";
    if (!(form?.invoiceEntries || []).some((entry) => String(entry.scope || "").trim() || Number(entry.total || 0))) {
      return "Add at least one invoice entry.";
    }
    return "";
  }

  async function resolveClientId() {
    if (!form) return "";
    if (form.clientMode === "existing") return form.clientId;
    const created = await sendJson("/api/clients", {
      method: "POST",
      body: {
        name: form.customerName.trim(),
        address: form.customerAddress.trim(),
        contact: form.customerPhone.trim(),
        email: form.customerEmail.trim(),
      },
    });
    invalidateApiQuery("/api/clients");
    await clientsQuery.refresh().catch(() => null);
    return created?.client?.id || "";
  }

  async function runInvoiceAction(action, successMessage) {
    const validationError = validateInvoice();
    if (validationError) {
      setError(validationError);
      return false;
    }

    if (!activeEstimate || !form) return false;

    setBusyAction(action);
    setError("");
    setMessage("");
    try {
      const clientId = await resolveClientId();
      const payload = {
        estimateId: activeEstimate.id,
        action,
        clientId: clientId || null,
        title: form.title.trim(),
        estimateDate: form.estimateDate,
        validUntil: form.validUntil,
        customerName: form.customerName.trim(),
        customerAddress: form.customerAddress.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim(),
        companyName: form.companyName.trim(),
        companyAddress: form.companyAddress.trim(),
        companyEmail: form.companyEmail.trim(),
        companyPhone: form.companyPhone.trim(),
        invoiceReference: form.invoiceReference.trim(),
        invoiceEntries: (form.invoiceEntries || []).map((entry) => ({
          scope: String(entry.scope || "").trim(),
          total: Number(entry.total || 0),
        })),
      };

      const json = await sendJson("/api/estimate-workflow", {
        method: "POST",
        body: payload,
      });

      invalidateApiQuery("/api/estimates?compact=1");
      invalidateApiQuery("/api/estimates");
      await estimatesQuery.refresh().catch(() => null);
      const refreshedEstimate = json?.estimate || null;
      if (refreshedEstimate) {
        setForm(buildInvoiceForm(refreshedEstimate, company));
      }
      setDirty(false);
      setMessage(successMessage);
      return true;
    } catch (requestError) {
      setError(getInvoiceErrorMessage(requestError.message || "invoice_action_failed"));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function deleteInvoice() {
    if (!activeEstimate) return;
    if (!window.confirm(`Delete invoice data for "${activeEstimate.title || `Estimate #${activeEstimate.estimate_number}`}"?`)) return;

    setBusyAction("delete");
    setError("");
    setMessage("");
    try {
      await sendJson("/api/estimate-workflow", {
        method: "POST",
        body: {
          estimateId: activeEstimate.id,
          action: "delete_invoice",
        },
      });
      invalidateApiQuery("/api/estimates?compact=1");
      invalidateApiQuery("/api/estimates");
      await estimatesQuery.refresh().catch(() => null);
      setMessage("Invoice deleted.");
      if (!standalone) return;
      router.push(`/${roleBase}/invoicing`);
    } catch (requestError) {
      setError(getInvoiceErrorMessage(requestError.message || "invoice_delete_failed"));
    } finally {
      setBusyAction("");
    }
  }

  const invoiceRows = useMemo(() => invoiceRowsFromEstimate(activeEstimate), [activeEstimate]);
  const totalAmount = getInvoiceAmount(activeEstimate);

  return (
    <div className="space-y-4">
      <InlineMessage error={estimatesQuery.error || settingsQuery.error || clientsQuery.error || error} message={message} />

      {!standalone ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              className={fieldClass("flex-1")}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search invoices by estimate, client, reference, status, or value"
            />
            <button
              type="button"
              onClick={() => {
  setActiveInvoice(null);

  setForm({
    title: "",
    invoiceReference: "",
    estimateDate: "",
    validUntil: "",

    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",

    customerName: "",
    customerAddress: "",
    customerPhone: "",
    customerEmail: "",

    clientMode: "existing",
    clientId: "",

    invoiceEntries: [
      {
        id: crypto.randomUUID(),
        scope: "",
        total: "",
      },
    ],
  });

  setInvoiceModalOpen(true);
}}
              className="acm-btn acm-btn-primary h-9 px-4"
              disabled={!filteredInvoiceCandidates.length}
            >
              Create
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {filteredInvoiceCandidates.length ? filteredInvoiceCandidates.map((estimate) => (
              <CompactListRow
                key={estimate.id}
                primary={estimate.title || `Estimate #${estimate.estimate_number}`}
                secondary={`${estimate.client?.name || "Client"} | ${formatDate(estimate.estimate_date)}`}
                tertiary={`${formatCurrency(getInvoiceAmount(estimate))} | Ref: ${estimate.invoice_reference || "Pending"}`}
                onClick={() => router.push(`/${roleBase}/invoicing/${estimate.id}`)}
                actions={
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getInvoiceTone(estimate.invoice_status)}`}>
                      {getInvoiceLabel(estimate.invoice_status)}
                    </span>
                    {/* <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/${roleBase}/invoicing/${estimate.id}`);
                      }}
                      className="rounded-full border border-[color:var(--acm-border)] px-3 py-1 text-xs font-semibold text-[color:var(--acm-fg)]"
                    >
                      Open
                    </button> */}
                  </div>
                }
              />
            )) : (
              <div className="rounded-[18px] border border-dashed border-[color:var(--acm-border)] px-4 py-8 text-sm text-[color:var(--acm-muted-fg)] lg:col-span-3">
                No invoices match the current search.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {standalone ? (
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
                {/* <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--acm-border)] pb-4"> */}
                <div className="grid grid-cols-[520px_520px] items-start justify-between gap-6 border-b border-[color:var(--acm-border)] pb-4">
                  {/* <div className="min-w-[260px] flex-1 space-y-2"> */}
                  <div className="w-[520px] space-y-2">
                    <input className={sheetFieldClass("text-xl font-bold")} value={form.companyName} onChange={(event) => updateForm("companyName", event.target.value)} placeholder="Company name" />
                    <textarea className={sheetFieldClass("min-h-[52px] resize-none")} value={form.companyAddress} onChange={(event) => updateForm("companyAddress", event.target.value)} placeholder="Company address" />
                    <div className="grid gap-2 md:grid-cols-2">
                      <input className={sheetFieldClass()} value={form.companyPhone} onChange={(event) => updateForm("companyPhone", event.target.value)} placeholder="Company phone" />
                      <input className={sheetFieldClass()} value={form.companyEmail} onChange={(event) => updateForm("companyEmail", event.target.value)} placeholder="Company email" />
                    </div>
                  </div>
                  {/* <div className="min-w-[240px] space-y-2 text-right"> */}
                  <div className="w-[520px] space-y-2 text-right">
                    <input className={sheetFieldClass("text-right text-lg font-bold")} value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="Invoice title" />
                    <div className="grid gap-2">
                      <div className="grid grid-cols-[296px_1fr] items-center gap-2">
                        {/* <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">Reference</span> */}
                        <input className={sheetFieldClass("text-right")} value={form.invoiceReference} onChange={(event) => updateForm("invoiceReference", event.target.value)} placeholder="Invoice reference" />
                      {/* </div>
                      <div className="grid grid-cols-[96px_1fr] items-center gap-2"> */}
                        {/* <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--acm-muted-fg)]">Estimate No</span> */}
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
                  {/* <div className="space-y-3 rounded-[18px] border border-[color:var(--acm-border)] p-3"> */}
                    <div className="flex items-center justify-between gap-4">

  {/* LEFT */}
  <div className="text-lg font-semibold uppercase tracking-[0.16em] text-[color:var(--acm-muted-fg)]">
    Client Details
  </div>

  {/* RIGHT */}
  <div className="ml-auto flex items-center gap-3">

    <select
      className={fieldClass(
        "w-[180px] bg-white text-[color:var(--acm-fg)] py-0"
      )}
      value={form.clientMode}
      onChange={(event) =>
        handleClientModeChange(event.target.value)
      }
    >
      <option value="existing">
        Existing Client
      </option>

      <option value="new">
        Create New
      </option>
    </select>

    {form.clientMode === "existing" ? (
      <select
        className={fieldClass(
          "w-[220px] bg-white text-[color:var(--acm-fg)] py-0"
        )}
        value={form.clientId}
        onChange={(event) =>
          handleClientSelect(event.target.value)
        }
      >
        <option value="">
          Choose Client
        </option>

        {clients.map((client) => (
          <option
            key={client.id}
            value={client.id}
          >
            {client.name ||
              client.email ||
              "Client"}
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
                  {/* </div> */}
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
      ) : null}
    </div>
  );
}
