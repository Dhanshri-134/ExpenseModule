"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useApiQuery, invalidateApiQuery } from "@/lib/client/apiQuery";
import { sendJson } from "@/lib/client/apiClient";
import { InvoiceCandidateGrid } from "@/features/invoicing/components/InvoiceCandidateGrid";
import { InvoiceEditorPanel } from "@/features/invoicing/components/InvoiceEditorPanel";
import { getLocalDateInputValue } from "@/shared/utils/dateTime";

function fieldClass(extra = "") {
  return `acm-input mt-0 h-9 text-[color:var(--acm-fg)] ${extra}`.trim();
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

function getInvoiceAmount(invoice) {
  return Number(invoice?.summary?.finalBid || invoice?.summary?.totalPrice || invoice?.totalAmount || 0);
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

function createInvoiceEntry(index = 1) {
  return {
    id: `entry-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    scope: "",
    total: "",
  };
}

function normalizeInvoiceRecord(invoice) {
  if (!invoice) return null;
  return {
    ...invoice,
    estimate_number: invoice.invoice_number,
    estimate_date: invoice.invoice_date,
    invoice_status: invoice.status || "draft",
    summary: invoice.summary || {},
  };
}

function buildInvoiceForm(invoice, company) {
  const meta = invoice?.summary?.documentMeta || {};
  const customer = meta.customer || {};
  const invoiceMeta = meta.invoice || {};
  const companyMeta = meta.company || {};
  const today = getLocalDateInputValue();
  const entries = Array.isArray(invoiceMeta.entries) && invoiceMeta.entries.length ? invoiceMeta.entries : [{ id: "entry-1", scope: "", total: 0 }];

  return {
    clientMode: invoice?.client_id ? "existing" : "new",
    clientId: invoice?.client_id || "",
    title: invoice?.title || "Invoice",
    estimateDate: invoice?.estimate_date || invoice?.invoice_date || today,
    validUntil: meta.validUntil || invoice?.valid_until || invoice?.invoice_date || today,
    customerName: customer.name || invoice?.client?.name || "",
    customerAddress: customer.address || invoice?.client?.address || "",
    customerEmail: customer.email || invoice?.client?.email || "",
    customerPhone: customer.phone || invoice?.client?.contact || "",
    companyName: companyMeta.name || company?.name || "",
    companyAddress: companyMeta.address || company?.address || "",
    companyEmail: companyMeta.contactEmail || company?.email || "",
    companyPhone: companyMeta.contactPhone || company?.contact || "",
    invoiceReference: invoiceMeta.invoiceReference || invoice?.invoice_reference || "",
    invoiceEntries: entries.map((entry, index) => ({
      id: entry.id || `entry-${index + 1}`,
      scope: entry.scope || "",
      total: String(Number(entry.total || 0)),
    })),
  };
}

function emptyInvoiceForm(company) {
  const today = getLocalDateInputValue();
  return {
    clientMode: "existing",
    clientId: "",
    title: "Invoice",
    estimateDate: today,
    validUntil: today,
    customerName: "",
    customerAddress: "",
    customerEmail: "",
    customerPhone: "",
    companyName: company?.name || "",
    companyAddress: company?.address || "",
    companyEmail: company?.email || "",
    companyPhone: company?.contact || "",
    invoiceReference: "",
    invoiceEntries: [createInvoiceEntry(1)],
  };
}

function InlineMessage({ error, message, onDismiss }) {
  if (!error && !message) return null;
  return (
    <div className={`${error ? "acm-message-error" : "acm-message-success"} flex items-start justify-between gap-3`}>
      <span>{error || message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-full border border-current px-2 py-0.5 text-xs font-semibold leading-none opacity-80 transition hover:opacity-100"
        aria-label="Close message"
      >
        x
      </button>
    </div>
  );
}

export function InvoicingWorkspace({ roleBase = "owner", initialEstimateId = "", standalone = false }) {
  const router = useRouter();
  const invoicesQueryKey = standalone ? (initialEstimateId ? `/api/invoices?id=${initialEstimateId}` : "") : "/api/invoices?compact=1";
  const invoicesQuery = useApiQuery(invoicesQueryKey);
  const settingsQuery = useApiQuery("/api/settings");
  const clientsQuery = useApiQuery("/api/clients");

  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(initialEstimateId);
  const [editorOpen, setEditorOpen] = useState(Boolean(standalone && initialEstimateId));
  const [isCreatingNew, setIsCreatingNew] = useState(!initialEstimateId && standalone);
  const [dismissedBanner, setDismissedBanner] = useState("");
  const editorRef = useRef(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const company = settingsQuery.data?.company || null;
  const clients = useMemo(() => clientsQuery.data?.clients || [], [clientsQuery.data?.clients]);
  const invoices = useMemo(
    () => (invoicesQuery.data?.invoices || []).map(normalizeInvoiceRecord),
    [invoicesQuery.data?.invoices]
  );

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((invoice) =>
        matchesSearchQuery(
          deferredSearchQuery,
          invoice.title,
          invoice.invoice_reference,
          invoice.invoice_number,
          invoice.client?.name,
          invoice.status,
          invoice.summary?.finalBid,
          invoice.summary?.totalPrice
        )
      ),
    [deferredSearchQuery, invoices]
  );

  const queryError = invoicesQuery.error || settingsQuery.error || clientsQuery.error || "";
  const activeBanner = error || queryError || message || "";
  const activeBannerKey = `${error ? "error" : queryError ? "query" : message ? "message" : "none"}:${activeBanner}`;
  const bannerError = error || queryError;
  const bannerMessage = error || queryError ? "" : message;

  const activeInvoice = useMemo(() => {
    if (isCreatingNew) return null;
    if (standalone) return invoices.find((invoice) => invoice.id === initialEstimateId) || invoices[0] || null;
    return filteredInvoices.find((invoice) => invoice.id === selectedInvoiceId) || filteredInvoices[0] || null;
  }, [filteredInvoices, initialEstimateId, invoices, isCreatingNew, selectedInvoiceId, standalone]);

  useEffect(() => {
    if (!company) return;
    if (isCreatingNew) {
      setForm((current) => current || emptyInvoiceForm(company));
      return;
    }
    if (!activeInvoice) return;
    setForm(buildInvoiceForm(activeInvoice, company));
    setDirty(false);
  }, [activeInvoice, company, isCreatingNew]);

  useEffect(() => {
    if (!form || form.clientMode !== "existing" || !form.clientId || !clients.length) return;
    const selectedClient = clients.find((item) => item.id === form.clientId);
    if (!selectedClient) return;

    const nextName = selectedClient.name || "";
    const nextAddress = selectedClient.address || "";
    const nextEmail = selectedClient.email || "";
    const nextPhone = selectedClient.contact || "";

    if (
      form.customerName === nextName &&
      form.customerAddress === nextAddress &&
      form.customerEmail === nextEmail &&
      form.customerPhone === nextPhone
    ) {
      return;
    }

    setForm((current) => ({
      ...(current || {}),
      customerName: nextName,
      customerAddress: nextAddress,
      customerEmail: nextEmail,
      customerPhone: nextPhone,
    }));
  }, [clients, form]);

  useEffect(() => {
    if (standalone) return;
    if (!filteredInvoices.length) {
      setSelectedInvoiceId("");
      return;
    }
    if (!selectedInvoiceId || !filteredInvoices.some((invoice) => invoice.id === selectedInvoiceId)) {
      setSelectedInvoiceId(filteredInvoices[0].id);
    }
  }, [filteredInvoices, selectedInvoiceId, standalone]);

  useEffect(() => {
    if (!editorOpen) return;
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editorOpen, activeInvoice?.id, isCreatingNew]);

  useEffect(() => {
    setDismissedBanner("");
  }, [activeBannerKey]);

  useEffect(() => {
    if (!activeBanner || dismissedBanner === activeBannerKey) return undefined;
    const timeoutMs = bannerError ? 8000 : 4000;
    const timeoutId = window.setTimeout(() => {
      if (bannerError === error) setError("");
      if (bannerMessage === message) setMessage("");
      setDismissedBanner(activeBannerKey);
    }, timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [activeBanner, activeBannerKey, bannerError, bannerMessage, dismissedBanner, error, message]);

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

  function dismissBanner() {
    setError("");
    setMessage("");
    setDismissedBanner(activeBannerKey);
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
    setForm((current) => {
      const selectedClient = nextMode === "existing" ? clients.find((item) => item.id === current?.clientId) : null;
      return {
        ...(current || {}),
        clientMode: nextMode,
        clientId: nextMode === "existing" ? current?.clientId || "" : "",
        customerName: nextMode === "existing" ? selectedClient?.name || current?.customerName || "" : current?.customerName || "",
        customerAddress: nextMode === "existing" ? selectedClient?.address || current?.customerAddress || "" : current?.customerAddress || "",
        customerEmail: nextMode === "existing" ? selectedClient?.email || current?.customerEmail || "" : current?.customerEmail || "",
        customerPhone: nextMode === "existing" ? selectedClient?.contact || current?.customerPhone || "" : current?.customerPhone || "",
      };
    });
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
    invalidateApiQuery("/api/clients", { refetchType: "none" });
    await clientsQuery.refresh().catch(() => null);
    return created?.client?.id || "";
  }

  function validateInvoice() {
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

  async function runInvoiceAction(_action, successMessage) {
    const validationError = validateInvoice();
    if (validationError) {
      setError(validationError);
      return false;
    }

    setBusyAction("save_invoice");
    setError("");
    setMessage("");
    try {
      const clientId = await resolveClientId();
      const payload = {
        ...(isCreatingNew ? {} : { id: activeInvoice?.id }),
        clientId: clientId || null,
        title: form.title.trim(),
        invoiceDate: form.estimateDate,
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

      const json = await sendJson("/api/invoices", {
        method: isCreatingNew ? "POST" : "PUT",
        body: payload,
      });

      invalidateApiQuery("/api/invoices?compact=1", { refetchType: "none" });
      invalidateApiQuery("/api/invoices", { refetchType: "none" });
      await invoicesQuery.refresh().catch(() => null);
      const savedInvoice = normalizeInvoiceRecord(json?.invoice || null);
      if (savedInvoice) {
        setSelectedInvoiceId(savedInvoice.id);
        setForm(buildInvoiceForm(savedInvoice, company));
      }
      setIsCreatingNew(false);
      setEditorOpen(true);
      setDirty(false);
      setMessage(successMessage);
      return true;
    } catch (requestError) {
      const detail =
        typeof requestError?.payload?.detail === "string"
          ? requestError.payload.detail
          : requestError?.payload?.detail?.message || "";
      setError(detail || requestError.message || "invoice_action_failed");
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function deleteInvoice() {
    if (!activeInvoice?.id) return;
    if (!window.confirm(`Delete invoice "${activeInvoice.title || `#${activeInvoice.estimate_number}`}"?`)) return;
    setBusyAction("delete");
    setError("");
    setMessage("");
    try {
      await sendJson("/api/invoices", {
        method: "DELETE",
        body: { id: activeInvoice.id },
      });
      invalidateApiQuery("/api/invoices?compact=1", { refetchType: "none" });
      invalidateApiQuery("/api/invoices", { refetchType: "none" });
      await invoicesQuery.refresh().catch(() => null);
      setEditorOpen(false);
      setIsCreatingNew(false);
      setMessage("Invoice deleted.");
      if (standalone) {
        router.push(`/${roleBase}/invoicing`);
      }
    } catch (requestError) {
      setError(requestError.message || "invoice_delete_failed");
    } finally {
      setBusyAction("");
    }
  }

  function downloadInvoicePdf(invoiceId) {
    if (!invoiceId) return;
    const url = `/api/invoices?id=${invoiceId}&export=pdf&disposition=attachment`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openExistingInvoice(invoiceId) {
    if (!invoiceId) return;
    router.push(`/${roleBase}/invoicing/${invoiceId}`);
  }

  function openCreateInvoice() {
    router.push(`/${roleBase}/invoicing/new`);
  }

  const displayInvoice = isCreatingNew
    ? { id: "", title: form?.title || "Invoice", estimate_number: "New", invoice_status: "not_started", invoice_reference: form?.invoiceReference || "" }
    : activeInvoice;

  const totalAmount = (form?.invoiceEntries || []).reduce((sum, entry) => sum + Number(entry.total || 0), 0);

  return (
    <div className="space-y-4">
      {activeBanner && dismissedBanner !== activeBannerKey ? (
        <InlineMessage error={bannerError} message={bannerMessage} onDismiss={dismissBanner} />
      ) : null}

      {!standalone ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              className={fieldClass("flex-1")}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search invoices by title, client, reference, status, or value"
            />
            <button type="button" onClick={openCreateInvoice} className="acm-btn acm-btn-primary h-9 px-4">
              Create
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <InvoiceCandidateGrid
              estimates={filteredInvoices}
              roleBase={roleBase}
              router={router}
              onOpenEstimate={openExistingInvoice}
              selectedEstimateId={selectedInvoiceId || ""}
              onSelectEstimate={setSelectedInvoiceId}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              getInvoiceAmount={getInvoiceAmount}
              getInvoiceTone={getInvoiceTone}
              getInvoiceLabel={getInvoiceLabel}
            />
          </div>
        </section>
      ) : null}

      {standalone ? (
        <div ref={editorRef}>
          <InvoiceEditorPanel
            roleBase={roleBase}
            router={router}
            activeEstimate={displayInvoice}
            form={form}
            standalone={standalone}
            editorVisible
            busyAction={busyAction}
            clients={clients}
            totalAmount={totalAmount}
            confirmDiscardChanges={confirmDiscardChanges}
            onCloseEditor={() => setEditorOpen(false)}
            getInvoiceTone={getInvoiceTone}
            getInvoiceLabel={getInvoiceLabel}
            runInvoiceAction={runInvoiceAction}
            downloadInvoicePdf={downloadInvoicePdf}
            deleteInvoice={deleteInvoice}
            updateForm={updateForm}
            handleClientModeChange={handleClientModeChange}
            handleClientSelect={handleClientSelect}
            updateInvoiceEntry={updateInvoiceEntry}
            removeInvoiceEntry={removeInvoiceEntry}
            addInvoiceEntry={addInvoiceEntry}
            formatCurrency={formatCurrency}
          />
        </div>
      ) : null}
    </div>
  );
}
