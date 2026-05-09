import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";

const WorkflowSchema = z.object({
  estimateId: z.string().uuid(),
  action: z.enum(["approve", "mark_invoice_ready", "complete_invoice"]),
  invoiceReference: z.string().optional().nullable(),
  scopeOfWork: z.string().optional().nullable(),
  totalCode: z.string().optional().nullable(),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
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

  if (parsed.data.action === "mark_invoice_ready") {
    patch.invoice_status = "draft";
    patch.invoice_reference = parsed.data.invoiceReference || estimate.invoice_reference || null;
    patch.summary = {
      ...existingSummary,
      documentMeta: {
        ...existingDocumentMeta,
        invoice: {
          ...existingInvoiceMeta,
          invoiceReference: parsed.data.invoiceReference || estimate.invoice_reference || null,
          scopeOfWork: parsed.data.scopeOfWork ?? existingInvoiceMeta.scopeOfWork ?? "",
          totalCode: parsed.data.totalCode ?? existingInvoiceMeta.totalCode ?? "",
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
        invoice: {
          ...existingInvoiceMeta,
          invoiceReference: parsed.data.invoiceReference || estimate.invoice_reference || null,
          scopeOfWork: parsed.data.scopeOfWork ?? existingInvoiceMeta.scopeOfWork ?? "",
          totalCode: parsed.data.totalCode ?? existingInvoiceMeta.totalCode ?? "",
        },
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
