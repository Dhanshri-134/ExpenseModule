import { z } from "zod";
import { canAccessProject, getRequestContext } from "@/lib/server/authz";
import { extractCompanyAssetMetadata } from "@/lib/server/companyAssets";
import { expenseReportToPdfBuffer, EXPENSE_STATUS_OPTIONS, EXPENSE_TYPES } from "@/lib/projectModules";
import { sendError, sendOk, rejectMethod } from "@/lib/server/responses";
import { loadUserDirectory } from "@/lib/server/taskWorkflow";
import { paginateCollection, parsePaginationParams } from "@/shared/services/api/pagination";

const optionalUuid = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().uuid().optional()
);

const optionalText = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().optional()
);

const ExpenseTypeSchema = z.enum(["employee_labor", "subcontractor", "material", "equipment"]);
const ExpenseStatusSchema = z.enum(["pending", "approved", "paid"]);

const QuerySchema = z.object({
  projectId: optionalUuid,
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  projectFilter: optionalUuid,
  expenseType: optionalText,
  status: optionalText,
  createdByUserId: optionalUuid,
  search: z.string().optional().nullable(),
  export: z.enum(["pdf"]).optional(),
  disposition: z.enum(["inline", "attachment"]).optional().default("attachment"),
});

const ExpensePayloadSchema = z.object({
  id: optionalUuid,
  projectId: z.string().uuid(),
  expenseType: ExpenseTypeSchema,
  status: ExpenseStatusSchema.default("approved"),
  partyName: z.string().optional().nullable(),
  amount: z.coerce.number().nonnegative(),
  quantity: z.coerce.number().nonnegative().optional().default(0),
  unitRate: z.coerce.number().nonnegative().optional().default(0),
  markupPercent: z.coerce.number().min(0).optional().default(0),
  note: z.string().optional().nullable(),
  expenseDate: z.string().min(1),
  vendor: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  details: z.record(z.string(), z.any()).optional().default({}),
});

function normalizeExpensePayload(payload = {}) {
  return {
    expenseType: String(payload.expenseType || "").trim(),
    status: String(payload.status || "approved").trim(),
    partyName: String(payload.partyName || "").trim(),
    amount: Number(payload.amount || 0),
    quantity: Number(payload.quantity || 0),
    unitRate: Number(payload.unitRate || 0),
    markupPercent: Number(payload.markupPercent || 0),
    note: String(payload.note || "").trim(),
    expenseDate: String(payload.expenseDate || "").trim(),
    vendor: String(payload.vendor || "").trim(),
    paymentMethod: String(payload.paymentMethod || "").trim(),
    referenceNumber: String(payload.referenceNumber || "").trim(),
    receiptUrl: String(payload.receiptUrl || "").trim(),
    details: payload.details && typeof payload.details === "object" ? payload.details : {},
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
    expense.expense_type,
    expense.party_name,
    expense.note,
    expense.vendor,
    expense.payment_method,
    expense.reference_number,
    expense.status,
    expense.expense_date,
    expense.project?.name,
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
    if (filters.projectFilter && expense.project_id !== filters.projectFilter) return false;
    if (filters.expenseType && filters.expenseType !== "all" && expense.expense_type !== filters.expenseType) return false;
    if (filters.status && filters.status !== "all" && expense.status !== filters.status) return false;
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
    if (parsed.data.projectId && !canAccessProject(ctx, parsed.data.projectId)) return sendError(res, 403, "forbidden");
    if (parsed.data.projectFilter && !canAccessProject(ctx, parsed.data.projectFilter)) return sendError(res, 403, "forbidden");

    let expenseQuery = ctx.admin
      .from("project_expenses")
      .select("*")
      .eq("company_id", ctx.company.id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (parsed.data.projectId) {
      expenseQuery = expenseQuery.eq("project_id", parsed.data.projectId);
    } else if (ctx.role !== "owner") {
      if (!ctx.projectIds.length) {
        return sendOk(res, {
          expenses: [],
          expenseTypes: EXPENSE_TYPES,
          statusOptions: EXPENSE_STATUS_OPTIONS,
          projects: [],
        });
      }
      expenseQuery = expenseQuery.in("project_id", ctx.projectIds);
    }

    let projectQuery = ctx.admin
      .from("projects")
      .select("id, name, job_number, location, client_id, contract_value")
      .eq("company_id", ctx.company.id)
      .order("created_at", { ascending: false });

    if (parsed.data.projectId) {
      projectQuery = projectQuery.eq("id", parsed.data.projectId);
    } else if (ctx.role !== "owner") {
      projectQuery = projectQuery.in("id", ctx.projectIds);
    }

    const [{ data: rows, error }, { data: projects }] = await Promise.all([
      expenseQuery,
      projectQuery,
    ]);

    if (error) return sendError(res, 500, "project_expenses_fetch_failed", error.message);
    if (parsed.data.projectId && !(projects ?? []).length) return sendError(res, 404, "project_not_found");

    const clientIds = [...new Set((projects ?? []).map((project) => project.client_id).filter(Boolean))];
    const [{ data: clients }, enrichedRows] = await Promise.all([
      clientIds.length
        ? ctx.admin.from("clients").select("id, name, contact, email, address").in("id", clientIds)
        : Promise.resolve({ data: [] }),
      enrichExpenses(ctx.admin, ctx.company.id, rows ?? []),
    ]);

    const projectMap = new Map((projects ?? []).map((project) => [project.id, {
      ...project,
      client: (clients ?? []).find((client) => client.id === project.client_id) ?? null,
    }]));

    const enrichedExpenses = enrichedRows.map((expense) => ({
      ...expense,
      project: projectMap.get(expense.project_id) ?? null,
    }));

    const filteredExpenses = applyFilters(enrichedExpenses, parsed.data);
    const pagination = parsePaginationParams(req.query, { pageSize: 25, maxPageSize: 100 });
    const pagedExpenses = paginateCollection(filteredExpenses, pagination);

    if (parsed.data.export === "pdf") {
      const { data: company } = await ctx.admin
        .from("companies")
        .select("id, name, address, contact, email, metadata")
        .eq("id", ctx.company.id)
        .maybeSingle();

      const companyMetadata = extractCompanyAssetMetadata(ctx.admin, company?.metadata);
      const pdfBuffer = await expenseReportToPdfBuffer({
        project: parsed.data.projectId ? projectMap.get(parsed.data.projectId) ?? null : null,
        projects: Array.from(projectMap.values()),
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
        `${parsed.data.disposition === "inline" ? "inline" : "attachment"}; filename="${parsed.data.projectId ? `project-expenses-${projectMap.get(parsed.data.projectId)?.job_number || "report"}` : "expenses-dashboard-report"}.pdf"`
      );
      res.status(200).send(pdfBuffer);
      return;
    }

    return sendOk(res, {
      expenses: pagedExpenses.items,
      expenseTypes: EXPENSE_TYPES,
      statusOptions: EXPENSE_STATUS_OPTIONS,
      projects: Array.from(projectMap.values()),
      ...(pagination.enabled ? { pagination: pagedExpenses.pagination } : {}),
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
        category: payload.expenseType,
        expense_type: payload.expenseType,
        status: payload.status,
        party_name: payload.partyName || null,
        amount: payload.amount,
        quantity: payload.quantity,
        unit_rate: payload.unitRate,
        markup_percent: payload.markupPercent,
        note: payload.note || null,
        expense_date: payload.expenseDate,
        vendor: payload.vendor || null,
        payment_method: payload.paymentMethod || null,
        reference_number: payload.referenceNumber || null,
        receipt_url: payload.receiptUrl || null,
        details: payload.details,
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
        category: payload.expenseType,
        expense_type: payload.expenseType,
        status: payload.status,
        party_name: payload.partyName || null,
        amount: payload.amount,
        quantity: payload.quantity,
        unit_rate: payload.unitRate,
        markup_percent: payload.markupPercent,
        note: payload.note || null,
        expense_date: payload.expenseDate,
        vendor: payload.vendor || null,
        payment_method: payload.paymentMethod || null,
        reference_number: payload.referenceNumber || null,
        receipt_url: payload.receiptUrl || null,
        details: payload.details,
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

  return rejectMethod(res, ["GET", "POST", "PUT", "DELETE"]);
}
