import { z } from "zod";
import { canAccessProject, getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { normalizeFieldReportPayload } from "@/lib/projectModules";
import { loadUserDirectory } from "@/lib/server/taskWorkflow";

const optionalUuid = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().uuid().optional()
);

const QuerySchema = z.object({
  projectId: optionalUuid,
});

const TextEntrySchema = z.union([z.string(), z.object({ text: z.string().optional() })]);
const PublicCommunicationSchema = z.object({
  name: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
});
const ContractorLaborSchema = z.object({
  classification: z.string().optional().nullable(),
  personnel: z.string().optional().nullable(),
});
const SubcontractorSchema = z.object({
  companyName: z.string().optional().nullable(),
  supervisor: z.string().optional().nullable(),
  totalPersons: z.string().optional().nullable(),
});
const EquipmentUsedSchema = z.object({
  equipmentType: z.string().optional().nullable(),
  makeModel: z.string().optional().nullable(),
  typeOfWork: z.string().optional().nullable(),
  timeInUse: z.string().optional().nullable(),
});
const MaterialsUsedSchema = z.object({
  type: z.string().optional().nullable(),
  amountUsed: z.string().optional().nullable(),
  amountRemaining: z.string().optional().nullable(),
});

const FieldReportPayloadSchema = z.object({
  id: optionalUuid,
  projectId: z.string().uuid(),
  reportDate: z.string().min(1),
  reportTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  weatherConditions: z.string().optional().nullable(),
  temperatureRange: z.string().optional().nullable(),
  temperatureValue: z.union([z.coerce.number(), z.string(), z.literal(""), z.null()]).optional(),
  temperatureUnit: z.enum(["F", "C"]).optional().default("F"),
  weatherImpact: z.string().optional().nullable(),
  publicCommunications: z.array(PublicCommunicationSchema).default([]),
  contractorLaborForce: z.array(ContractorLaborSchema).default([]),
  subcontractorsOnsite: z.array(SubcontractorSchema).default([]),
  equipmentUsed: z.array(EquipmentUsedSchema).default([]),
  materialsUsed: z.array(MaterialsUsedSchema).default([]),
  workActivities: z.array(TextEntrySchema).default([]),
  coordinationLogs: z.array(TextEntrySchema).default([]),
  comments: z.string().optional().nullable(),
  sitePictures: z.array(z.string()).default([]),
  signoffName: z.string().optional().nullable(),
  signoffRole: z.string().optional().nullable(),
});

function canManageFieldReports(ctx, projectId) {
  return canAccessProject(ctx, projectId);
}

function canEditFieldReport(ctx, report) {
  if (ctx.role === "owner" || ctx.role === "manager") return true;
  return report.created_by_user_id === ctx.user.id;
}

function parseTemperatureValue(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function enrichReports(admin, companyId, rows) {
  const userIds = [...new Set((rows ?? []).map((item) => item.created_by_user_id).filter(Boolean))];
  const directory = await loadUserDirectory(admin, companyId, userIds);

  return (rows ?? []).map((item) => ({
    ...item,
    created_by: item.created_by_user_id ? directory.get(item.created_by_user_id) ?? null : null,
  }));
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, "invalid_project_id");

    let query = ctx.admin
      .from("field_reports")
      .select("*")
      .eq("company_id", ctx.company.id)
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (parsed.data.projectId) {
      if (!canAccessProject(ctx, parsed.data.projectId)) return sendError(res, 403, "forbidden");
      query = query.eq("project_id", parsed.data.projectId);
    } else if (ctx.role !== "owner") {
      if (!ctx.projectIds.length) return sendOk(res, { reports: [] });
      query = query.in("project_id", ctx.projectIds);
    }

    const { data, error } = await query;
    if (error) return sendError(res, 500, "field_reports_fetch_failed", error.message);

    const projectIds = [...new Set((data ?? []).map((item) => item.project_id).filter(Boolean))];
    const { data: projects } = projectIds.length
      ? await ctx.admin.from("projects").select("id, name, job_number").in("id", projectIds)
      : { data: [] };
    const projectMap = new Map((projects ?? []).map((project) => [project.id, project]));

    const reports = (await enrichReports(ctx.admin, ctx.company.id, data ?? [])).map((report) => ({
      ...report,
      project: projectMap.get(report.project_id) ?? null,
    }));
    return sendOk(res, { reports });
  }

  if (req.method === "POST") {
    const parsed = FieldReportPayloadSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    if (!canManageFieldReports(ctx, parsed.data.projectId)) return sendError(res, 403, "forbidden");

    const payload = normalizeFieldReportPayload(parsed.data);
    const numericTemperatureValue = parseTemperatureValue(payload.temperatureValue);
    const { data, error } = await ctx.admin
      .from("field_reports")
      .insert({
        company_id: ctx.company.id,
        project_id: parsed.data.projectId,
        report_date: payload.reportDate,
        report_time: payload.reportTime || null,
        location: payload.location || null,
        weather_conditions: payload.weatherConditions || null,
        temperature_range: payload.temperatureRange || null,
        temperature_value: numericTemperatureValue,
        temperature_unit: numericTemperatureValue != null ? payload.temperatureUnit : null,
        weather_impact: payload.weatherImpact || null,
        public_communications: payload.publicCommunications,
        contractor_labor_force: payload.contractorLaborForce,
        subcontractors_onsite: payload.subcontractorsOnsite,
        equipment_used: payload.equipmentUsed,
        materials_used: payload.materialsUsed,
        work_activities: payload.workActivities,
        coordination_logs: payload.coordinationLogs,
        comments: payload.comments || null,
        site_pictures: payload.sitePictures,
        signoff_name: payload.signoffName || null,
        signoff_role: payload.signoffRole || null,
        created_by_user_id: ctx.user.id,
      })
      .select("*")
      .single();

    if (error || !data) return sendError(res, 500, "field_report_create_failed", error?.message);
    const [report] = await enrichReports(ctx.admin, ctx.company.id, [data]);
    return sendOk(res, { report });
  }

  if (req.method === "PUT") {
    const parsed = FieldReportPayloadSchema.safeParse(req.body);
    if (!parsed.success || !parsed.data.id) return sendError(res, 400, "invalid_payload", parsed.error?.flatten?.() ?? null);
    if (!canManageFieldReports(ctx, parsed.data.projectId)) return sendError(res, 403, "forbidden");

    const { data: existing } = await ctx.admin
      .from("field_reports")
      .select("id, created_by_user_id")
      .eq("company_id", ctx.company.id)
      .eq("project_id", parsed.data.projectId)
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (!existing) return sendError(res, 404, "field_report_not_found");
    if (!canEditFieldReport(ctx, existing)) return sendError(res, 403, "forbidden");

    const payload = normalizeFieldReportPayload(parsed.data);
    const numericTemperatureValue = parseTemperatureValue(payload.temperatureValue);
    const { data, error } = await ctx.admin
      .from("field_reports")
      .update({
        report_date: payload.reportDate,
        report_time: payload.reportTime || null,
        location: payload.location || null,
        weather_conditions: payload.weatherConditions || null,
        temperature_range: payload.temperatureRange || null,
        temperature_value: numericTemperatureValue,
        temperature_unit: numericTemperatureValue != null ? payload.temperatureUnit : null,
        weather_impact: payload.weatherImpact || null,
        public_communications: payload.publicCommunications,
        contractor_labor_force: payload.contractorLaborForce,
        subcontractors_onsite: payload.subcontractorsOnsite,
        equipment_used: payload.equipmentUsed,
        materials_used: payload.materialsUsed,
        work_activities: payload.workActivities,
        coordination_logs: payload.coordinationLogs,
        comments: payload.comments || null,
        site_pictures: payload.sitePictures,
        signoff_name: payload.signoffName || null,
        signoff_role: payload.signoffRole || null,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", ctx.company.id)
      .eq("project_id", parsed.data.projectId)
      .eq("id", parsed.data.id)
      .select("*")
      .single();

    if (error || !data) return sendError(res, 500, "field_report_update_failed", error?.message);
    const [report] = await enrichReports(ctx.admin, ctx.company.id, [data]);
    return sendOk(res, { report });
  }

  if (req.method === "DELETE") {
    const parsed = z.object({ id: optionalUuid, projectId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
    if (!parsed.data.id) return sendError(res, 400, "invalid_payload", { message: "Field report id is required." });
    if (!canManageFieldReports(ctx, parsed.data.projectId)) return sendError(res, 403, "forbidden");

    const { data: existing } = await ctx.admin
      .from("field_reports")
      .select("id, created_by_user_id")
      .eq("company_id", ctx.company.id)
      .eq("project_id", parsed.data.projectId)
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (!existing) return sendError(res, 404, "field_report_not_found");
    if (!canEditFieldReport(ctx, existing)) return sendError(res, 403, "forbidden");

    const { error } = await ctx.admin
      .from("field_reports")
      .delete()
      .eq("company_id", ctx.company.id)
      .eq("project_id", parsed.data.projectId)
      .eq("id", parsed.data.id);

    if (error) return sendError(res, 500, "field_report_delete_failed", error.message);
    return sendOk(res, { deleted: true });
  }

  return sendError(res, 405, "method_not_allowed");
}
