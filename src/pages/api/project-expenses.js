import { z } from "zod";
import { canAccessProject, getRequestContext } from "@/lib/server/authz";
import { extractCompanyAssetMetadata } from "@/lib/server/companyAssets";
import { expenseReportToPdfBuffer, EXPENSE_CATEGORIES } from "@/lib/projectModules";
import { sendError, sendOk } from "@/lib/server/responses";
import { loadUserDirectory } from "@/lib/server/taskWorkflow";

const optionalUuid = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().uuid().optional()
);

const QuerySchema = z.object({
  projectId: z.string().uuid(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  createdByUserId: optionalUuid,
  search: z.string().optional().nullable(),
  export: z.enum(["pdf"]).optional(),
  disposition: z.enum(["inline", "attachment"]).optional().default("attachment"),
});

const ExpensePayloadSchema = z.object({
  id: optionalUuid,
  projectId: z.string().uuid(),
  category: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  note: z.string().optional().nullable(),
  expenseDate: z.string().min(1),
  vendor: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
});

function normalizeExpensePayload(payload = {}) {
  return {
    category: String(payload.category || "").trim(),
    amount: Number(payload.amount || 0),
    note: String(payload.note || "").trim(),
    expenseDate: String(payload.expenseDate || "").trim(),
    vendor: String(payload.vendor || "").trim(),
    paymentMethod: String(payload.paymentMethod || "").trim(),
    referenceNumber: String(payload.referenceNumber || "").trim(),
    receiptUrl: String(payload.receiptUrl || "").trim(),
  };
}

function canEditExpense(ctx, expense) {
  if (ctx.role === "owner" || ctx.role === "manager") return true;
  return expense.created_by_user_id === ctx.user.id;
}

function matchesExpenseSearch(expense, query) {
  const search = String(query || "").trim().toLowerCase();
  if (!search) return true;
  return [
    expense.category,
    expense.note,
    expense.vendor,
    expense.payment_method,
    expense.reference_number,
    expense.expense_date,
    expense.created_by?.name,
    expense.created_by?.user_name,
    expense.created_by?.user_code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(search);
}

async function enrichExpenses(admin, companyId, rows) {
  const userIds = [...new Set((rows ?? []).map((item) => item.created_by_user_id).filter(Boolean))];
  const directory = await loadUserDirectory(admin, companyId, userIds);

  return (rows ?? []).map((item) => ({
    ...item,
    created_by: item.created_by_user_id ? directory.get(item.created_by_user_id) ?? null : null,
  }));
}

function applyFilters(expenses, filters) {
  return (expenses ?? []).filter((expense) => {
    if (filters.category && filters.category !== "all" && expense.category !== filters.category) return false;
    if (filters.createdByUserId && expense.created_by_user_id !== filters.createdByUserId) return false;
    if (filters.startDate && expense.expense_date < filters.startDate) return false;
    if (filters.endDate && expense.expense_date > filters.endDate) return false;
    if (!matchesExpenseSearch(expense, filters.search)) return false;
    return true;
  });
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, "invalid_project_expense_query", parsed.error.flatten());
    if (!canAccessProject(ctx, parsed.data.projectId)) return sendError(res, 403, "forbidden");

    const [{ data: rows, error }, { data: project }] = await Promise.all([
      ctx.admin
        .from("project_expenses")
        .select("*")
        .eq("company_id", ctx.company.id)
        .eq("project_id", parsed.data.projectId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      ctx.admin
        .from("projects")
        .select("id, name, job_number, location, client_id")
        .eq("company_id", ctx.company.id)
        .eq("id", parsed.data.projectId)
        .maybeSingle(),
    ]);

    if (error) return sendError(res, 500, "project_expenses_fetch_failed", error.message);
    if (!project) return sendError(res, 404, "project_not_found");

    const [{ data: client }, enrichedRows] = await Promise.all([
      project.client_id
        ? ctx.admin.from("clients").select("id, name, contact, email, address").eq("id", project.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      enrichExpenses(ctx.admin, ctx.company.id, rows ?? []),
    ]);

    const filteredExpenses = applyFilters(enrichedRows, parsed.data);

    if (parsed.data.export === "pdf") {
      const { data: company } = await ctx.admin
        .from("companies")
        .select("id, name, address, contact, email, metadata")
        .eq("id", ctx.company.id)
        .maybeSingle();

      const companyMetadata = extractCompanyAssetMetadata(ctx.admin, company?.metadata);
      const pdfBuffer = await expenseReportToPdfBuffer({
        project: {
          ...project,
          client: client ?? null,
        },
        company: company
          ? {
              name: company.name,
              address: company.address,
              contactEmail: company.email,
              contactPhone: company.contact,
              logoDataUrl: companyMetadata.logoUrl,
              signatureDataUrl: companyMetadata.signatureUrl,
              signatureName: companyMetadata.signatureName,
              stampDataUrl: companyMetadata.stampUrl,
              stampLabel: companyMetadata.stampLabel,
            }
          : {},
        expenses: filteredExpenses,
        filters: parsed.data,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader(
        "Content-Disposition",
        `${parsed.data.disposition === "inline" ? "inline" : "attachment"}; filename="project-expenses-${project.job_number || "report"}.pdf"`
      );
      res.status(200).send(pdfBuffer);
      return;
    }

    return sendOk(res, {
      expenses: filteredExpenses,
      categories: EXPENSE_CATEGORIES,
    });
  }

  if (req.method === "POST") {
    const parsed = ExpensePayloadSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    if (!canAccessProject(ctx, parsed.data.projectId)) return sendError(res, 403, "forbidden");

    const payload = normalizeExpensePayload(parsed.data);
    const { data, error } = await ctx.admin
      .from("project_expenses")
      .insert({
        company_id: ctx.company.id,
        project_id: parsed.data.projectId,
        category: payload.category,
        amount: payload.amount,
        note: payload.note || null,
        expense_date: payload.expenseDate,
        vendor: payload.vendor || null,
        payment_method: payload.paymentMethod || null,
        reference_number: payload.referenceNumber || null,
        receipt_url: payload.receiptUrl || null,
        created_by_user_id: ctx.user.id,
      })
      .select("*")
      .single();

    if (error || !data) return sendError(res, 500, "project_expense_create_failed", error?.message);
    const [expense] = await enrichExpenses(ctx.admin, ctx.company.id, [data]);
    return sendOk(res, { expense });
  }

  if (req.method === "PUT") {
    const parsed = ExpensePayloadSchema.safeParse(req.body);
    if (!parsed.success || !parsed.data.id) return sendError(res, 400, "invalid_payload", parsed.error?.flatten?.() ?? null);
    if (!canAccessProject(ctx, parsed.data.projectId)) return sendError(res, 403, "forbidden");

    const { data: existing } = await ctx.admin
      .from("project_expenses")
      .select("id, created_by_user_id")
      .eq("company_id", ctx.company.id)
      .eq("project_id", parsed.data.projectId)
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (!existing) return sendError(res, 404, "project_expense_not_found");
    if (!canEditExpense(ctx, existing)) return sendError(res, 403, "forbidden");

    const payload = normalizeExpensePayload(parsed.data);
    const { data, error } = await ctx.admin
      .from("project_expenses")
      .update({
        category: payload.category,
        amount: payload.amount,
        note: payload.note || null,
        expense_date: payload.expenseDate,
        vendor: payload.vendor || null,
        payment_method: payload.paymentMethod || null,
        reference_number: payload.referenceNumber || null,
        receipt_url: payload.receiptUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", ctx.company.id)
      .eq("project_id", parsed.data.projectId)
      .eq("id", parsed.data.id)
      .select("*")
      .single();

    if (error || !data) return sendError(res, 500, "project_expense_update_failed", error?.message);
    const [expense] = await enrichExpenses(ctx.admin, ctx.company.id, [data]);
    return sendOk(res, { expense });
  }

  if (req.method === "DELETE") {
    const parsed = z.object({ id: optionalUuid, projectId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success || !parsed.data.id) return sendError(res, 400, "invalid_payload", parsed.error?.flatten?.() ?? null);
    if (!canAccessProject(ctx, parsed.data.projectId)) return sendError(res, 403, "forbidden");

    const { data: existing } = await ctx.admin
      .from("project_expenses")
      .select("id, created_by_user_id")
      .eq("company_id", ctx.company.id)
      .eq("project_id", parsed.data.projectId)
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (!existing) return sendError(res, 404, "project_expense_not_found");
    if (!canEditExpense(ctx, existing)) return sendError(res, 403, "forbidden");

    const { error } = await ctx.admin
      .from("project_expenses")
      .delete()
      .eq("company_id", ctx.company.id)
      .eq("project_id", parsed.data.projectId)
      .eq("id", parsed.data.id);

    if (error) return sendError(res, 500, "project_expense_delete_failed", error.message);
    return sendOk(res, { deleted: true });
  }

  return sendError(res, 405, "method_not_allowed");
}
