import { z } from "zod";
import { requireApiContext } from "@/shared/services/security/request";
import { sendError, sendOk, rejectMethod } from "@/shared/services/api/responses";
import { extractCompanyAssetMetadata } from "@/lib/server/companyAssets";

const optionalUuid = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().uuid().optional()
);

const QuerySchema = z.object({
  id: optionalUuid,
  export: z.enum(["pdf"]).optional(),
  disposition: z.enum(["attachment", "inline"]).optional(),
  compact: z.string().optional(),
});

const InvoiceEntrySchema = z.object({
  id: z.string().optional(),
  scope: z.string().optional().nullable(),
  total: z.coerce.number().nonnegative().optional().default(0),
});

const InvoicePayloadSchema = z.object({
  id: optionalUuid,
  clientId: optionalUuid,
  projectId: optionalUuid,
  invoiceNumber: z.coerce.number().int().nonnegative().optional(),
  title: z.string().optional().nullable(),
  invoiceReference: z.string().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  status: z.string().optional().default("draft"),
  customerName: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  customerEmail: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  companyEmail: z.string().optional().nullable(),
  companyPhone: z.string().optional().nullable(),
  invoiceEntries: z.array(InvoiceEntrySchema).optional().default([]),
});

function normalizePayload(payload) {
  const invoiceDate = String(payload.invoiceDate || "").trim() || new Date().toISOString().slice(0, 10);
  return {
    ...payload,
    title: String(payload.title || "").trim() || "Invoice",
    invoiceReference: String(payload.invoiceReference || "").trim(),
    invoiceDate,
    validUntil: String(payload.validUntil || "").trim() || invoiceDate,
    invoiceEntries: (payload.invoiceEntries ?? []).map((entry, index) => ({
      id: entry.id || `entry-${index + 1}`,
      scope: String(entry.scope || "").trim(),
      total: Number(entry.total || 0),
    })),
  };
}

async function attachRelations(ctx, invoices) {
  const clientIds = [...new Set((invoices ?? []).map((item) => item.client_id).filter(Boolean))];
  const projectIds = [...new Set((invoices ?? []).map((item) => item.project_id).filter(Boolean))];

  const [{ data: clients }, { data: projects }] = await Promise.all([
    clientIds.length ? ctx.admin.from("clients").select("id, name, contact, email, address").in("id", clientIds) : Promise.resolve({ data: [] }),
    projectIds.length ? ctx.admin.from("projects").select("id, name, location").in("id", projectIds) : Promise.resolve({ data: [] }),
  ]);

  const clientMap = new Map((clients ?? []).map((item) => [item.id, item]));
  const projectMap = new Map((projects ?? []).map((item) => [item.id, item]));

  return (invoices ?? []).map((invoice) => ({
    ...invoice,
    client: invoice.client_id ? clientMap.get(invoice.client_id) ?? null : null,
    project: invoice.project_id ? projectMap.get(invoice.project_id) ?? null : null,
  }));
}

function toInvoicePdfRecord(invoice) {
  return {
    id: invoice.id,
    title: invoice.title,
    estimate_number: invoice.invoice_number,
    estimate_date: invoice.invoice_date,
    client: invoice.client || null,
    summary: invoice.summary || {},
    line_items: [],
    cost_codes: [],
  };
}

function isMissingInvoicesTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes('relation "invoices" does not exist') ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    message.includes("invoices relation") ||
    message.includes("pgrst")
  );
}

export default async function handler(req, res) {
  const ctx = await requireApiContext(req, res, { moduleKey: "invoices" });
  if (!ctx) return;

  if (req.method === "GET") {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, "invalid_query", parsed.error.flatten());

    const { id, export: exportType, disposition, compact } = parsed.data;
    let query = ctx.admin.from("invoices").select("*").eq("company_id", ctx.company.id);
    if (id) query = query.eq("id", id);
    const { data, error } = await query.order("invoice_number", { ascending: false });
    if (error) {
      if (!id && isMissingInvoicesTableError(error)) {
        return sendOk(res, { invoices: [], compact: compact === "1" || compact === "true" });
      }
      return sendError(res, 500, "invoices_fetch_failed", error.message);
    }

    const invoices = await attachRelations(ctx, data ?? []);
    if (id && !invoices.length) return sendError(res, 404, "invoice_not_found");

    if (exportType === "pdf" && id) {
      const invoice = invoices[0];
      const { estimateToPdfBuffer } = await import("@/lib/projectModules");
      const { data: company } = await ctx.admin
        .from("companies")
        .select("id, name, address, contact, email, metadata")
        .eq("id", ctx.company.id)
        .maybeSingle();

      const companyMetadata = extractCompanyAssetMetadata(ctx.admin, company?.metadata);
      const pdfRecord = toInvoicePdfRecord({
        ...invoice,
        summary: {
          ...(invoice.summary || {}),
          documentMeta: {
            ...((invoice.summary || {}).documentMeta || {}),
            company: {
              name: company?.name || invoice.summary?.documentMeta?.company?.name || "",
              address: company?.address || invoice.summary?.documentMeta?.company?.address || "",
              contactEmail: company?.email || invoice.summary?.documentMeta?.company?.contactEmail || "",
              contactPhone: company?.contact || invoice.summary?.documentMeta?.company?.contactPhone || "",
              logoText: companyMetadata.logoText || company?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 3) || "INV",
              logoDataUrl: companyMetadata.logoUrl || "",
              signatureDataUrl: companyMetadata.signatureUrl || "",
              signatureName: companyMetadata.signatureName || "",
              stampDataUrl: companyMetadata.stampUrl || "",
              stampLabel: companyMetadata.stampLabel || company?.name || "",
            },
          },
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader(
        "Content-Disposition",
        `${disposition === "inline" ? "inline" : "attachment"}; filename="invoice-${invoice.invoice_number}.pdf"`
      );
      res.status(200).send(await estimateToPdfBuffer(pdfRecord, { documentType: "invoice" }));
      return;
    }

    return sendOk(res, { invoices, compact: compact === "1" || compact === "true" });
  }

  if (req.method === "POST") {
    const parsed = InvoicePayloadSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    const payload = normalizePayload(parsed.data);

    const { data: latestInvoice, error: latestInvoiceError } = await ctx.admin
      .from("invoices")
      .select("invoice_number")
      .eq("company_id", ctx.company.id)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (isMissingInvoicesTableError(latestInvoiceError)) {
      return sendError(res, 500, "invoices_table_missing", "Invoices table is not deployed in the current database.");
    }

    const grandTotal = payload.invoiceEntries.reduce((sum, entry) => sum + Number(entry.total || 0), 0);
    const summary = {
      totalPrice: grandTotal,
      finalBid: grandTotal,
      documentMeta: {
        validUntil: payload.validUntil,
        customer: {
          name: payload.customerName || "",
          address: payload.customerAddress || "",
          email: payload.customerEmail || "",
          phone: payload.customerPhone || "",
        },
        company: {
          name: payload.companyName || "",
          address: payload.companyAddress || "",
          contactEmail: payload.companyEmail || "",
          contactPhone: payload.companyPhone || "",
        },
        invoice: {
          invoiceReference: payload.invoiceReference || "",
          entries: payload.invoiceEntries,
        },
        totals: {
          grandTotal,
        },
      },
    };

    const { data: invoice, error } = await ctx.admin
      .from("invoices")
      .insert({
        company_id: ctx.company.id,
        client_id: payload.clientId || null,
        project_id: payload.projectId || null,
        invoice_number: payload.invoiceNumber || (latestInvoice?.invoice_number || 0) + 1,
        title: payload.title,
        invoice_reference: payload.invoiceReference || null,
        invoice_date: payload.invoiceDate,
        valid_until: payload.validUntil || null,
        status: payload.status || "draft",
        line_items: payload.invoiceEntries,
        summary,
        created_by_user_id: ctx.user.id,
      })
      .select("*")
      .single();

    if (error || !invoice) {
      if (isMissingInvoicesTableError(error)) {
        return sendError(res, 500, "invoices_table_missing", "Invoices table is not deployed in the current database.");
      }
      return sendError(res, 500, "invoice_create_failed", error?.message);
    }
    const [enriched] = await attachRelations(ctx, [invoice]);
    return sendOk(res, { invoice: enriched });
  }

  if (req.method === "PUT") {
    const parsed = InvoicePayloadSchema.safeParse(req.body);
    if (!parsed.success || !parsed.data.id) return sendError(res, 400, "invalid_payload", parsed.error?.flatten?.() ?? null);
    const payload = normalizePayload(parsed.data);
    const grandTotal = payload.invoiceEntries.reduce((sum, entry) => sum + Number(entry.total || 0), 0);
    const summary = {
      totalPrice: grandTotal,
      finalBid: grandTotal,
      documentMeta: {
        validUntil: payload.validUntil,
        customer: {
          name: payload.customerName || "",
          address: payload.customerAddress || "",
          email: payload.customerEmail || "",
          phone: payload.customerPhone || "",
        },
        company: {
          name: payload.companyName || "",
          address: payload.companyAddress || "",
          contactEmail: payload.companyEmail || "",
          contactPhone: payload.companyPhone || "",
        },
        invoice: {
          invoiceReference: payload.invoiceReference || "",
          entries: payload.invoiceEntries,
        },
        totals: {
          grandTotal,
        },
      },
    };

    const { data: invoice, error } = await ctx.admin
      .from("invoices")
      .update({
        client_id: payload.clientId || null,
        project_id: payload.projectId || null,
        invoice_number: payload.invoiceNumber || undefined,
        title: payload.title,
        invoice_reference: payload.invoiceReference || null,
        invoice_date: payload.invoiceDate,
        valid_until: payload.validUntil || null,
        status: payload.status || "draft",
        line_items: payload.invoiceEntries,
        summary,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", ctx.company.id)
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error || !invoice) {
      if (isMissingInvoicesTableError(error)) {
        return sendError(res, 500, "invoices_table_missing", "Invoices table is not deployed in the current database.");
      }
      return sendError(res, 500, "invoice_update_failed", error?.message);
    }
    const [enriched] = await attachRelations(ctx, [invoice]);
    return sendOk(res, { invoice: enriched });
  }

  if (req.method === "DELETE") {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    const { error } = await ctx.admin.from("invoices").delete().eq("company_id", ctx.company.id).eq("id", parsed.data.id);
    if (error) return sendError(res, 500, "invoice_delete_failed", error.message);
    return sendOk(res, { deleted: true });
  }

  return rejectMethod(res, ["GET", "POST", "PUT", "DELETE"]);
}
