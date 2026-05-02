import { z } from "zod";
import { canAccessProject, getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { estimateToCsv } from "@/lib/projectModules";
import { loadUserDirectory } from "@/lib/server/taskWorkflow";
import {
  buildEstimateComputation,
  composeEstimateRecord,
  loadEstimateGraph,
  persistEstimateGraph,
} from "@/lib/server/estimating/estimateEngine";

const optionalUuid = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().uuid().optional()
);

const nullableUuid = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.string().uuid().nullable().optional()
);

const QuerySchema = z.object({
  projectId: z.string().uuid(),
  id: optionalUuid,
  export: z.string().optional(),
});

const LaborRateSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional().nullable(),
  baseWage: z.coerce.number().nonnegative().optional().default(0),
  fica: z.coerce.number().nonnegative().optional().default(0),
  sui: z.coerce.number().nonnegative().optional().default(0),
  fui: z.coerce.number().nonnegative().optional().default(0),
  workersComp: z.coerce.number().nonnegative().optional().default(0),
  liability: z.coerce.number().nonnegative().optional().default(0),
  benefits: z.coerce.number().nonnegative().optional().default(0),
  tools: z.coerce.number().nonnegative().optional().default(0),
  ppe: z.coerce.number().nonnegative().optional().default(0),
  overheadPercent: z.coerce.number().nonnegative().optional().default(0),
});

const LaborEntrySchema = z.object({
  id: z.string().optional(),
  projectUserId: nullableUuid,
  laborRateId: nullableUuid,
  description: z.string().optional().nullable(),
  stHours: z.coerce.number().nonnegative().optional().default(0),
  stRate: z.coerce.number().nonnegative().optional().default(0),
  otHours: z.coerce.number().nonnegative().optional().default(0),
  otRate: z.coerce.number().nonnegative().optional().default(0),
  rate: LaborRateSchema.optional(),
});

const MaterialEntrySchema = z.object({
  id: z.string().optional(),
  materialId: nullableUuid,
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().nonnegative().optional().default(0),
  wastePercent: z.coerce.number().nonnegative().optional().default(0),
  unitRate: z.coerce.number().nonnegative().optional().default(0),
  freight: z.coerce.number().nonnegative().optional().default(0),
  taxPercent: z.coerce.number().nonnegative().optional().default(0),
});

const EquipmentEntrySchema = z.object({
  id: z.string().optional(),
  equipmentId: nullableUuid,
  description: z.string().optional().nullable(),
  qty: z.coerce.number().nonnegative().optional().default(0),
  days: z.coerce.number().nonnegative().optional().default(0),
  rate: z.coerce.number().nonnegative().optional().default(0),
  freight: z.coerce.number().nonnegative().optional().default(0),
  fuel: z.coerce.number().nonnegative().optional().default(0),
  taxPercent: z.coerce.number().nonnegative().optional().default(0),
});

const DirectOverheadEntrySchema = z.object({
  id: z.string().optional(),
  description: z.string().optional().nullable(),
  qty: z.coerce.number().nonnegative().optional().default(0),
  days: z.coerce.number().nonnegative().optional().default(0),
  rate: z.coerce.number().nonnegative().optional().default(0),
  taxPercent: z.coerce.number().nonnegative().optional().default(0),
});

const EstimateLineItemSchema = z.object({
  id: z.string().optional(),
  scope: z.string().optional().nullable(),
  costCode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  quantity: z.coerce.number().nonnegative().optional().nullable(),
  laborHours: z.coerce.number().nonnegative().optional().nullable(),
  laborCost: z.coerce.number().nonnegative().optional().nullable(),
  materialCost: z.coerce.number().nonnegative().optional().nullable(),
  equipmentCost: z.coerce.number().nonnegative().optional().nullable(),
  directOverheadCost: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const CostCodeInputSchema = z.object({
  costCodeId: nullableUuid,
  code: z.string().min(1).optional().nullable(),
  name: z.string().min(1).optional().nullable(),
  description: z.string().optional().nullable(),
  overheadPercent: z.coerce.number().nonnegative().optional(),
  profitPercent: z.coerce.number().nonnegative().optional(),
  commissionPercent: z.coerce.number().nonnegative().optional(),
  riskPercent: z.coerce.number().nonnegative().optional(),
  inflationRate: z.coerce.number().nonnegative().optional(),
  escalationYears: z.coerce.number().nonnegative().optional(),
  laborEntries: z.array(LaborEntrySchema).optional().default([]),
  materialEntries: z.array(MaterialEntrySchema).optional().default([]),
  equipmentEntries: z.array(EquipmentEntrySchema).optional().default([]),
  overheadEntries: z.array(DirectOverheadEntrySchema).optional().default([]),
});

const EstimatePayloadSchema = z.object({
  id: optionalUuid,
  projectId: z.string().uuid(),
  title: z.string().optional().nullable(),
  estimateDate: z.string().optional().nullable(),
  status: z.string().min(1).default("draft"),
  scenario: z.enum(["best_case", "expected_case", "worst_case"]).default("expected_case"),
  overheadPercent: z.coerce.number().nonnegative().default(0),
  profitPercent: z.coerce.number().nonnegative().default(0),
  commissionPercent: z.coerce.number().nonnegative().default(0),
  riskPercent: z.coerce.number().nonnegative().default(0),
  inflationRate: z.coerce.number().nonnegative().default(0),
  escalationYears: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  lineItems: z.array(EstimateLineItemSchema).optional().default([]),
  costCodes: z.array(CostCodeInputSchema).optional().default([]),
});

function normalizeEstimatePayload(payload) {
  const estimateDate =
    String(payload.estimateDate || "").trim() || new Date().toISOString().slice(0, 10);
  const title =
    String(payload.title || "").trim() || `Estimate ${estimateDate}`;

  return {
    ...payload,
    title,
    estimateDate,
  };
}

function canManageEstimates(ctx, projectId) {
  if (!canAccessProject(ctx, projectId)) return false;
  return ctx.role === "owner" || ctx.role === "manager";
}

async function enrichEstimates(admin, companyId, rows) {
  const preparedByIds = [...new Set((rows ?? []).map((item) => item.prepared_by_user_id).filter(Boolean))];
  const directory = await loadUserDirectory(admin, companyId, preparedByIds);

  return (rows ?? []).map((item) => ({
    ...item,
    prepared_by: item.prepared_by_user_id ? directory.get(item.prepared_by_user_id) ?? null : null,
  }));
}

async function attachEstimateGraphs(admin, estimates) {
  try {
    const graph = await loadEstimateGraph(
      admin,
      (estimates ?? []).map((estimate) => estimate.id).filter(Boolean)
    );

    return (estimates ?? []).map((estimate) => composeEstimateRecord(estimate, graph.get(estimate.id) ?? []));
  } catch {
    return estimates ?? [];
  }
}

async function createEstimateHeader(ctx, payload, computed) {
  const { data: latestEstimate } = await ctx.admin
    .from("project_estimates")
    .select("estimate_number")
    .eq("project_id", payload.projectId)
    .order("estimate_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await ctx.admin
    .from("project_estimates")
    .insert({
      company_id: ctx.company.id,
      project_id: payload.projectId,
      estimate_number: (latestEstimate?.estimate_number || 0) + 1,
      title: payload.title,
      estimate_date: payload.estimateDate,
      status: payload.status,
      scenario: payload.scenario,
      overhead_percent: computed.summary.overheadPercent,
      profit_percent: computed.summary.profitPercent,
      commission_percent: computed.summary.commissionPercent,
      risk_percent: computed.summary.riskPercent,
      inflation_rate: computed.summary.inflationRate,
      escalation_years: computed.summary.escalationYears,
      notes: payload.notes || null,
      line_items: [],
      summary: computed.summary,
      prepared_by_user_id: ctx.user.id,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "estimate_create_failed");
  return data;
}

async function updateEstimateHeader(ctx, payload, computed) {
  const { data, error } = await ctx.admin
    .from("project_estimates")
    .update({
      title: payload.title,
      estimate_date: payload.estimateDate,
      status: payload.status,
      scenario: payload.scenario,
      overhead_percent: computed.summary.overheadPercent,
      profit_percent: computed.summary.profitPercent,
      commission_percent: computed.summary.commissionPercent,
      risk_percent: computed.summary.riskPercent,
      inflation_rate: computed.summary.inflationRate,
      escalation_years: computed.summary.escalationYears,
      notes: payload.notes || null,
      line_items: [],
      summary: computed.summary,
      updated_at: new Date().toISOString(),
      prepared_by_user_id: ctx.user.id,
    })
    .eq("company_id", ctx.company.id)
    .eq("project_id", payload.projectId)
    .eq("id", payload.id)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "estimate_update_failed");
  return data;
}

async function syncEstimateSnapshot(admin, estimate) {
  const { error } = await admin
    .from("project_estimates")
    .update({
      line_items: estimate.line_items ?? [],
      summary: estimate.summary ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimate.id);

  if (error) throw new Error(error.message || "estimate_snapshot_sync_failed");
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, "invalid_project_id");

    const { projectId, id, export: exportType } = parsed.data;
    if (!canAccessProject(ctx, projectId)) return sendError(res, 403, "forbidden");

    if (exportType === "csv" && id) {
      const { data: estimate, error } = await ctx.admin
        .from("project_estimates")
        .select("*")
        .eq("company_id", ctx.company.id)
        .eq("project_id", projectId)
        .eq("id", id)
        .maybeSingle();

      if (error || !estimate) return sendError(res, 404, "estimate_not_found");

      const [composedEstimate] = await attachEstimateGraphs(ctx.admin, [estimate]);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="estimate-${estimate.estimate_number}.csv"`);
      res.status(200).send(estimateToCsv(composedEstimate));
      return;
    }

    const { data, error } = await ctx.admin
      .from("project_estimates")
      .select("*")
      .eq("company_id", ctx.company.id)
      .eq("project_id", projectId)
      .order("estimate_number", { ascending: false });

    if (error) return sendError(res, 500, "estimates_fetch_failed", error.message);

    const estimatesWithGraph = await attachEstimateGraphs(ctx.admin, data ?? []);
    const estimates = await enrichEstimates(ctx.admin, ctx.company.id, estimatesWithGraph);
    return sendOk(res, { estimates });
  }

  if (req.method === "POST") {
    const parsed = EstimatePayloadSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    const payload = normalizeEstimatePayload(parsed.data);
    if (!canManageEstimates(ctx, payload.projectId)) return sendError(res, 403, "forbidden");

    try {
      const computed = buildEstimateComputation(payload);
      const estimate = await createEstimateHeader(ctx, payload, computed);
      await persistEstimateGraph(ctx.admin, ctx, estimate, computed);
      const [composedEstimate] = await attachEstimateGraphs(ctx.admin, [estimate]);
      await syncEstimateSnapshot(ctx.admin, composedEstimate);
      const [enrichedEstimate] = await enrichEstimates(ctx.admin, ctx.company.id, [composedEstimate]);
      return sendOk(res, { estimate: enrichedEstimate });
    } catch (error) {
      return sendError(res, 500, "estimate_create_failed", error.message);
    }
  }

  if (req.method === "PUT") {
    const parsed = EstimatePayloadSchema.safeParse(req.body);
    if (!parsed.success || !parsed.data.id) {
      return sendError(res, 400, "invalid_payload", parsed.error?.flatten?.() ?? null);
    }
    const payload = normalizeEstimatePayload(parsed.data);
    if (!canManageEstimates(ctx, payload.projectId)) return sendError(res, 403, "forbidden");

    try {
      const computed = buildEstimateComputation(payload);
      const estimate = await updateEstimateHeader(ctx, payload, computed);
      await persistEstimateGraph(ctx.admin, ctx, estimate, computed);
      const [composedEstimate] = await attachEstimateGraphs(ctx.admin, [estimate]);
      await syncEstimateSnapshot(ctx.admin, composedEstimate);
      const [enrichedEstimate] = await enrichEstimates(ctx.admin, ctx.company.id, [composedEstimate]);
      return sendOk(res, { estimate: enrichedEstimate });
    } catch (error) {
      return sendError(res, 500, "estimate_update_failed", error.message);
    }
  }

  if (req.method === "DELETE") {
    const parsed = z.object({ id: z.string().uuid(), projectId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    if (!canManageEstimates(ctx, parsed.data.projectId)) return sendError(res, 403, "forbidden");

    const { error } = await ctx.admin
      .from("project_estimates")
      .delete()
      .eq("company_id", ctx.company.id)
      .eq("project_id", parsed.data.projectId)
      .eq("id", parsed.data.id);

    if (error) return sendError(res, 500, "estimate_delete_failed", error.message);
    return sendOk(res, { deleted: true });
  }

  return sendError(res, 405, "method_not_allowed");
}
