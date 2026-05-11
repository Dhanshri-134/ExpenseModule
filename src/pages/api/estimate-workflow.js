import { z } from "zod";
import { canAccessModule, getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";

const WorkflowSchema = z.object({
  estimateId: z.string().uuid(),
  action: z.enum(["approve", "mark_invoice_ready", "save_invoice", "complete_invoice", "delete_invoice"]),
  clientId: z.string().uuid().optional().nullable(),
  title: z.string().optional().nullable(),
  estimateDate: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  customerEmail: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  companyEmail: z.string().optional().nullable(),
  companyPhone: z.string().optional().nullable(),
  invoiceReference: z.string().optional().nullable(),
  scopeOfWork: z.string().optional().nullable(),
  totalCode: z.string().optional().nullable(),
  invoiceEntries: z.array(
    z.object({
      scope: z.string().optional().nullable(),
      total: z.union([z.number(), z.string()]).optional().nullable(),
    })
  ).optional().default([]),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (!canAccessModule(ctx, "invoices")) return sendError(res, 403, "forbidden");
  if (req.method !== "POST") return sendError(res, 405, "method_not_allowed");

  const parsed = WorkflowSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

  const { data: estimate, error: estimateError } = await ctx.admin
    .from("project_estimates")
    .select("*")
    .eq("company_id", ctx.company.id)
    .eq("id", parsed.data.estimateId)
    .maybeSingle();

  if (estimateError || !estimate) return sendError(res, 404, "estimate_not_found");

  const patch = { updated_at: new Date().toISOString() };
  const existingSummary = estimate.summary && typeof estimate.summary === "object" ? estimate.summary : {};
  const existingDocumentMeta =
    existingSummary.documentMeta && typeof existingSummary.documentMeta === "object"
      ? existingSummary.documentMeta
      : {};
  const existingInvoiceMeta =
    existingDocumentMeta.invoice && typeof existingDocumentMeta.invoice === "object"
      ? existingDocumentMeta.invoice
      : {};

  if (parsed.data.action === "approve") {
    patch.approval_status = "approved";
    patch.status = "approved";
    patch.approved_at = new Date().toISOString();
    patch.approved_by_user_id = ctx.user.id;
  }

  const nextCustomer = {
    ...(existingDocumentMeta.customer && typeof existingDocumentMeta.customer === "object" ? existingDocumentMeta.customer : {}),
    ...(parsed.data.customerName !== undefined ? { name: parsed.data.customerName || "" } : {}),
    ...(parsed.data.customerAddress !== undefined ? { address: parsed.data.customerAddress || "" } : {}),
    ...(parsed.data.customerEmail !== undefined ? { email: parsed.data.customerEmail || "" } : {}),
    ...(parsed.data.customerPhone !== undefined ? { phone: parsed.data.customerPhone || "" } : {}),
  };

  const nextCompany = {
    ...(existingDocumentMeta.company && typeof existingDocumentMeta.company === "object" ? existingDocumentMeta.company : {}),
    ...(parsed.data.companyName !== undefined ? { name: parsed.data.companyName || "" } : {}),
    ...(parsed.data.companyAddress !== undefined ? { address: parsed.data.companyAddress || "" } : {}),
    ...(parsed.data.companyEmail !== undefined ? { contactEmail: parsed.data.companyEmail || "" } : {}),
    ...(parsed.data.companyPhone !== undefined ? { contactPhone: parsed.data.companyPhone || "" } : {}),
  };

  if (["mark_invoice_ready", "save_invoice", "complete_invoice"].includes(parsed.data.action)) {
    if (parsed.data.clientId !== undefined) patch.client_id = parsed.data.clientId || null;
    if (parsed.data.title !== undefined) patch.title = parsed.data.title || estimate.title;
    if (parsed.data.estimateDate !== undefined) patch.estimate_date = parsed.data.estimateDate || estimate.estimate_date;
  }

  if (parsed.data.action === "mark_invoice_ready" || parsed.data.action === "save_invoice") {
    patch.invoice_status = "draft";
    patch.invoice_reference = parsed.data.invoiceReference || estimate.invoice_reference || null;
    patch.summary = {
      ...existingSummary,
      documentMeta: {
        ...existingDocumentMeta,
        ...(parsed.data.validUntil !== undefined ? { validUntil: parsed.data.validUntil || "" } : {}),
        customer: nextCustomer,
        company: nextCompany,
        invoice: {
          ...existingInvoiceMeta,
          invoiceReference: parsed.data.invoiceReference || estimate.invoice_reference || null,
          scopeOfWork: parsed.data.scopeOfWork ?? existingInvoiceMeta.scopeOfWork ?? "",
          totalCode: parsed.data.totalCode ?? existingInvoiceMeta.totalCode ?? "",
          entries: (parsed.data.invoiceEntries ?? []).map((entry) => ({
            scope: entry.scope || "",
            total: Number(entry.total || 0),
          })),
        },
      },
    };
  }

  if (parsed.data.action === "complete_invoice") {
    patch.invoice_status = "completed";
    patch.invoice_reference = parsed.data.invoiceReference || estimate.invoice_reference || null;
    patch.invoice_completed_at = new Date().toISOString();
    patch.summary = {
      ...existingSummary,
      documentMeta: {
        ...existingDocumentMeta,
        ...(parsed.data.validUntil !== undefined ? { validUntil: parsed.data.validUntil || "" } : {}),
        customer: nextCustomer,
        company: nextCompany,
        invoice: {
          ...existingInvoiceMeta,
          invoiceReference: parsed.data.invoiceReference || estimate.invoice_reference || null,
          scopeOfWork: parsed.data.scopeOfWork ?? existingInvoiceMeta.scopeOfWork ?? "",
          totalCode: parsed.data.totalCode ?? existingInvoiceMeta.totalCode ?? "",
          entries: (parsed.data.invoiceEntries ?? []).map((entry) => ({
            scope: entry.scope || "",
            total: Number(entry.total || 0),
          })),
        },
      },
    };
  }

  if (parsed.data.action === "delete_invoice") {
    patch.invoice_status = "not_started";
    patch.invoice_reference = null;
    patch.invoice_completed_at = null;
    patch.summary = {
      ...existingSummary,
      documentMeta: {
        ...existingDocumentMeta,
        invoice: {},
      },
    };
  }

  const { data, error } = await ctx.admin
    .from("project_estimates")
    .update(patch)
    .eq("id", estimate.id)
    .select("*")
    .single();

  if (error || !data) return sendError(res, 500, "estimate_workflow_update_failed", error?.message);
  return sendOk(res, { estimate: data });
}
