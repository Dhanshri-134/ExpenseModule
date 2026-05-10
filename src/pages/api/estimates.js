import { z } from "zod";
import { canAccessModule, getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { estimateToCsv } from "@/lib/projectModules";
import { loadUserDirectory } from "@/lib/server/taskWorkflow";
import { extractCompanyAssetMetadata } from "@/lib/server/companyAssets";
import {
  buildEstimateComputation,
  composeEstimateRecord,
  loadEstimateGraph,
  persistEstimateGraph,
} from "@/lib/server/estimating/estimateEngine";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

const JsonRecordSchema = z.record(z.string(), z.any()).optional().default({});

const optionalUuid = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().uuid().optional()
);

const nullableUuid = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.string().uuid().nullable().optional()
);

const QuerySchema = z.object({
  projectId: optionalUuid,
  clientId: optionalUuid,
  id: optionalUuid,
  export: z.string().optional(),
  document: z.enum(["estimate", "invoice"]).optional(),
  disposition: z.enum(["attachment", "inline"]).optional(),
  compact: z.string().optional(),
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
  metadata: JsonRecordSchema,
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
  metadata: JsonRecordSchema,
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
  metadata: JsonRecordSchema,
});

const DirectOverheadEntrySchema = z.object({
  id: z.string().optional(),
  description: z.string().optional().nullable(),
  qty: z.coerce.number().nonnegative().optional().default(0),
  days: z.coerce.number().nonnegative().optional().default(0),
  rate: z.coerce.number().nonnegative().optional().default(0),
  taxPercent: z.coerce.number().nonnegative().optional().default(0),
  metadata: JsonRecordSchema,
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
  estimateNumber: z.coerce.number().int().nonnegative().optional(),
  projectId: optionalUuid,
  clientId: optionalUuid,
  templateId: optionalUuid,
  title: z.string().optional().nullable(),
  estimateDate: z.string().optional().nullable(),
  status: z.string().min(1).default("draft"),
  approvalStatus: z.string().optional().default("draft"),
  invoiceStatus: z.string().optional().default("not_started"),
  scenario: z.enum(["best_case", "expected_case", "worst_case"]).default("expected_case"),
  overheadPercent: z.coerce.number().nonnegative().default(0),
  profitPercent: z.coerce.number().nonnegative().default(0),
  commissionPercent: z.coerce.number().nonnegative().default(0),
  riskPercent: z.coerce.number().nonnegative().default(0),
  inflationRate: z.coerce.number().nonnegative().default(0),
  escalationYears: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  documentMeta: z.record(z.string(), z.any()).optional().default({}),
  lineItems: z.array(EstimateLineItemSchema).optional().default([]),
  costCodes: z.array(CostCodeInputSchema).optional().default([]),
});

function normalizeEstimatePayload(payload) {
  const estimateDate = String(payload.estimateDate || "").trim() || new Date().toISOString().slice(0, 10);
  const title = String(payload.title || "").trim() || `Estimate ${estimateDate}`;

  return {
    ...payload,
    estimateNumber: payload.estimateNumber ? Number(payload.estimateNumber) : undefined,
    title,
    estimateDate,
  };
}

function collectSuggestedCostCodes(payload) {
  const suggestions = [];
  const pushSuggestion = (code, description = "") => {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) return;
    suggestions.push({
      code: normalizedCode,
      name: String(description || normalizedCode).trim() || normalizedCode,
      description: String(description || "").trim() || null,
    });
  };

  (payload.costCodes ?? []).forEach((costCode) => {
    pushSuggestion(costCode.code, costCode.description || costCode.name);
    (costCode.laborEntries ?? []).forEach((entry) => pushSuggestion(entry.metadata?.code, entry.description));
    (costCode.materialEntries ?? []).forEach((entry) => pushSuggestion(entry.metadata?.code, entry.description));
    (costCode.equipmentEntries ?? []).forEach((entry) => pushSuggestion(entry.metadata?.code, entry.description));
    (costCode.overheadEntries ?? []).forEach((entry) => pushSuggestion(entry.metadata?.code, entry.description));
  });

  return suggestions;
}

async function seedCostCodeLibrary(admin, companyId, payload) {
  const suggestions = collectSuggestedCostCodes(payload);
  if (!suggestions.length) return;

  const codes = [...new Set(suggestions.map((item) => item.code))];
  const { data: existing } = await admin
    .from("cost_codes")
    .select("code")
    .eq("company_id", companyId)
    .in("code", codes);

  const existingCodes = new Set((existing ?? []).map((item) => item.code));
  const inserts = suggestions.filter((item, index) => !existingCodes.has(item.code) && suggestions.findIndex((candidate) => candidate.code === item.code) === index);
  if (!inserts.length) return;

  await admin.from("cost_codes").insert(
    inserts.map((item) => ({
      company_id: companyId,
      code: item.code,
      name: item.name,
      description: item.description,
    }))
  );
}

async function resolveClientId(ctx, payload) {
  if (payload.clientId) return payload.clientId;
  if (!payload.projectId) throw new Error("client_required");

  const { data: project, error } = await ctx.admin
    .from("projects")
    .select("client_id")
    .eq("company_id", ctx.company.id)
    .eq("id", payload.projectId)
    .maybeSingle();

  if (error || !project?.client_id) {
    throw new Error(error?.message || "project_client_not_found");
  }

  return project.client_id;
}

function canReadEstimateScope(ctx, estimate) {
  if (ctx.role === "owner") return true;
  if (estimate.project_id) return ctx.projectIds.includes(estimate.project_id);
  return true;
}

function canManageEstimates(ctx) {
  return ["owner", "manager", "employee"].includes(ctx.role);
}

async function enrichEstimates(admin, companyId, rows) {
  const preparedByIds = [...new Set((rows ?? []).map((item) => item.prepared_by_user_id).filter(Boolean))];
  const approvedByIds = [...new Set((rows ?? []).map((item) => item.approved_by_user_id).filter(Boolean))];
  const directory = await loadUserDirectory(admin, companyId, [...new Set([...preparedByIds, ...approvedByIds])]);

  return (rows ?? []).map((item) => ({
    ...item,
    prepared_by: item.prepared_by_user_id ? directory.get(item.prepared_by_user_id) ?? null : null,
    approved_by: item.approved_by_user_id ? directory.get(item.approved_by_user_id) ?? null : null,
  }));
}

async function attachEstimateGraphs(admin, estimates) {
  try {
    const graph = await loadEstimateGraph(admin, (estimates ?? []).map((estimate) => estimate.id).filter(Boolean));
    return (estimates ?? []).map((estimate) => composeEstimateRecord(estimate, graph.get(estimate.id) ?? []));
  } catch {
    return estimates ?? [];
  }
}

async function attachEstimateRelations(ctx, estimates) {
  const projectIds = [...new Set((estimates ?? []).map((item) => item.project_id).filter(Boolean))];
  const clientIds = [...new Set((estimates ?? []).map((item) => item.client_id).filter(Boolean))];
  const templateIds = [...new Set((estimates ?? []).map((item) => item.template_id).filter(Boolean))];

  const [{ data: projects }, { data: clients }, { data: templates }] = await Promise.all([
    projectIds.length
      ? ctx.admin.from("projects").select("id, name, client_id").in("id", projectIds)
      : Promise.resolve({ data: [] }),
    clientIds.length ? ctx.admin.from("clients").select("id, name, contact, email, address").in("id", clientIds) : Promise.resolve({ data: [] }),
    templateIds.length ? ctx.admin.from("estimate_templates").select("id, name, is_default, configuration").in("id", templateIds) : Promise.resolve({ data: [] }),
  ]);

  const clientMap = new Map((clients ?? []).map((client) => [client.id, client]));
  const templateMap = new Map((templates ?? []).map((template) => [template.id, template]));
  const projectMap = new Map(
    (projects ?? []).map((project) => [
      project.id,
      {
        ...project,
        client: project.client_id ? clientMap.get(project.client_id) ?? null : null,
      },
    ])
  );

  return (estimates ?? []).map((estimate) => ({
    ...estimate,
    client: estimate.client_id ? clientMap.get(estimate.client_id) ?? null : null,
    template: estimate.template_id ? templateMap.get(estimate.template_id) ?? null : null,
    project: estimate.project_id ? projectMap.get(estimate.project_id) ?? null : null,
  }));
}

async function createEstimateHeader(ctx, payload, computed) {
  const { data: latestEstimate } = await ctx.admin
    .from("project_estimates")
    .select("estimate_number")
    .eq("company_id", ctx.company.id)
    .order("estimate_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const summary = {
    ...computed.summary,
    documentMeta: payload.documentMeta || {},
  };

  const { data, error } = await ctx.admin
    .from("project_estimates")
    .insert({
      company_id: ctx.company.id,
      project_id: payload.projectId || null,
      client_id: payload.clientId,
      template_id: payload.templateId || null,
      estimate_number: payload.estimateNumber || (latestEstimate?.estimate_number || 0) + 1,
      title: payload.title,
      estimate_date: payload.estimateDate,
      status: payload.status,
      approval_status: payload.approvalStatus || "draft",
      invoice_status: payload.invoiceStatus || "not_started",
      scenario: payload.scenario,
      overhead_percent: summary.overheadPercent,
      profit_percent: summary.profitPercent,
      commission_percent: summary.commissionPercent,
      risk_percent: summary.riskPercent,
      inflation_rate: summary.inflationRate,
      escalation_years: summary.escalationYears,
      notes: payload.notes || null,
      line_items: [],
      summary,
      prepared_by_user_id: ctx.user.id,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "estimate_create_failed");
  return data;
}

async function updateEstimateHeader(ctx, payload, computed) {
  const summary = {
    ...computed.summary,
    documentMeta: payload.documentMeta || {},
  };

  const { data, error } = await ctx.admin
    .from("project_estimates")
    .update({
      project_id: payload.projectId || null,
      client_id: payload.clientId,
      template_id: payload.templateId || null,
      estimate_number: payload.estimateNumber || undefined,
      title: payload.title,
      estimate_date: payload.estimateDate,
      status: payload.status,
      approval_status: payload.approvalStatus || "draft",
      invoice_status: payload.invoiceStatus || "not_started",
      scenario: payload.scenario,
      overhead_percent: summary.overheadPercent,
      profit_percent: summary.profitPercent,
      commission_percent: summary.commissionPercent,
      risk_percent: summary.riskPercent,
      inflation_rate: summary.inflationRate,
      escalation_years: summary.escalationYears,
      notes: payload.notes || null,
      line_items: [],
      summary,
      updated_at: new Date().toISOString(),
      prepared_by_user_id: ctx.user.id,
    })
    .eq("company_id", ctx.company.id)
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
  if (!canAccessModule(ctx, "estimates")) return sendError(res, 403, "forbidden");

  if (req.method === "GET") {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, "invalid_query", parsed.error.flatten());

    const { projectId, clientId, id, export: exportType, document = "estimate", disposition, compact } = parsed.data;
    const useCompactResponse = compact === "1" || compact === "true";

    let query = ctx.admin.from("project_estimates").select("*").eq("company_id", ctx.company.id);
    if (id) query = query.eq("id", id);
    if (projectId) query = query.eq("project_id", projectId);
    if (clientId) query = query.eq("client_id", clientId);

    const { data, error } = await query.order("estimate_number", { ascending: false });
    if (error) return sendError(res, 500, "estimates_fetch_failed", error.message);

    const visible = (data ?? []).filter((estimate) => canReadEstimateScope(ctx, estimate));
    if (id && !visible.length) return sendError(res, 404, "estimate_not_found");

    if ((exportType === "csv" || exportType === "pdf") && id) {
      const [composedEstimate] = await attachEstimateGraphs(ctx.admin, visible.slice(0, 1));
      if (!composedEstimate) return sendError(res, 404, "estimate_not_found");
      const [estimateWithRelations] = await attachEstimateRelations(ctx, [composedEstimate]);
      const [enrichedEstimate] = await enrichEstimates(ctx.admin, ctx.company.id, [estimateWithRelations]);

      if (exportType === "pdf") {
        const { estimateToPdfBuffer } = await import("@/lib/projectModules");

        const { data: company } = await ctx.admin
          .from("companies")
          .select("id, name, address, contact, email, metadata")
          .eq("id", ctx.company.id)
          .maybeSingle();

        if (company) {
          const companyMetadata = extractCompanyAssetMetadata(ctx.admin, company.metadata);
          enrichedEstimate.summary = enrichedEstimate.summary || {};
          const existingMeta = enrichedEstimate.summary.documentMeta || {};
          
          enrichedEstimate.summary.documentMeta = {
            ...existingMeta,
            company: {
              name: company.name,
              address: company.address,
              contactEmail: company.email,
              contactPhone: company.contact,
              logoText: companyMetadata.logoText || company.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 3),
              logoDataUrl: companyMetadata.logoUrl,
              signatureDataUrl: companyMetadata.signatureUrl,
              signatureName: companyMetadata.signatureName,
              stampDataUrl: companyMetadata.stampUrl,
              stampLabel: companyMetadata.stampLabel,
              ...existingMeta.company,
            },
          };
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Cache-Control", "no-store, max-age=0");
        res.setHeader(
          "Content-Disposition",
          `${disposition === "inline" ? "inline" : "attachment"}; filename="${document === "invoice" ? "invoice" : "estimate"}-${enrichedEstimate.estimate_number}.pdf"`
        );
        res.status(200).send(await estimateToPdfBuffer(enrichedEstimate, { documentType: document }));
        return;
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="estimate-${enrichedEstimate.estimate_number}.csv"`);
      res.status(200).send(estimateToCsv(enrichedEstimate));
      return;
    }

    const estimatesWithGraph = useCompactResponse ? visible : await attachEstimateGraphs(ctx.admin, visible);
    const estimatesWithRelations = await attachEstimateRelations(ctx, estimatesWithGraph);
    const estimates = await enrichEstimates(ctx.admin, ctx.company.id, estimatesWithRelations);
    return sendOk(res, { estimates });
  }

  if (req.method === "POST") {
    const parsed = EstimatePayloadSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    if (!canManageEstimates(ctx)) return sendError(res, 403, "forbidden");

    const payload = normalizeEstimatePayload(parsed.data);

    try {
      payload.clientId = await resolveClientId(ctx, payload);
      await seedCostCodeLibrary(ctx.admin, ctx.company.id, payload);
      const computed = buildEstimateComputation(payload);
      const estimate = await createEstimateHeader(ctx, payload, computed);
      await persistEstimateGraph(ctx.admin, ctx, estimate, computed);
      const [composedEstimate] = await attachEstimateGraphs(ctx.admin, [estimate]);
      await syncEstimateSnapshot(ctx.admin, composedEstimate);
      const [withRelations] = await attachEstimateRelations(ctx, [composedEstimate]);
      const [enrichedEstimate] = await enrichEstimates(ctx.admin, ctx.company.id, [withRelations]);
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
    if (!canManageEstimates(ctx)) return sendError(res, 403, "forbidden");

    const payload = normalizeEstimatePayload(parsed.data);

    try {
      payload.clientId = await resolveClientId(ctx, payload);
      await seedCostCodeLibrary(ctx.admin, ctx.company.id, payload);
      const computed = buildEstimateComputation(payload);
      const estimate = await updateEstimateHeader(ctx, payload, computed);
      await persistEstimateGraph(ctx.admin, ctx, estimate, computed);
      const [composedEstimate] = await attachEstimateGraphs(ctx.admin, [estimate]);
      await syncEstimateSnapshot(ctx.admin, composedEstimate);
      const [withRelations] = await attachEstimateRelations(ctx, [composedEstimate]);
      const [enrichedEstimate] = await enrichEstimates(ctx.admin, ctx.company.id, [withRelations]);
      return sendOk(res, { estimate: enrichedEstimate });
    } catch (error) {
      return sendError(res, 500, "estimate_update_failed", error.message);
    }
  }

  if (req.method === "DELETE") {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    if (!canManageEstimates(ctx)) return sendError(res, 403, "forbidden");

    const { error } = await ctx.admin
      .from("project_estimates")
      .delete()
      .eq("company_id", ctx.company.id)
      .eq("id", parsed.data.id);

    if (error) return sendError(res, 500, "estimate_delete_failed", error.message);
    return sendOk(res, { deleted: true });
  }

  return sendError(res, 405, "method_not_allowed");
}
