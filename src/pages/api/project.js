import { z } from "zod";
import { canAccessProject, getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { getTaskWorkspace, loadUserDirectory } from "@/lib/server/taskWorkflow";

const QuerySchema = z.object({
  id: z.string().uuid(),
});

const UpdateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  location: z.string().optional().nullable(),
  clientName: z.string().min(1),
  clientContact: z.string().optional().nullable(),
  clientEmail: z.union([z.string().email(), z.literal("")]).optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  contractValue: z.coerce.number().nonnegative().default(0),
});

async function resolveClientId(ctx, payload) {
  const { data: existingClient } = await ctx.admin
    .from("clients")
    .select("id")
    .eq("company_id", ctx.company.id)
    .ilike("name", payload.clientName)
    .maybeSingle();

  if (existingClient?.id) {
    const { data: client, error } = await ctx.admin
      .from("clients")
      .update({
        name: payload.clientName,
        contact: payload.clientContact || null,
        email: payload.clientEmail || null,
        address: payload.clientAddress || null,
      })
      .eq("id", existingClient.id)
      .select("id")
      .single();

    if (error || !client) {
      throw new Error(error?.message || "client_update_failed");
    }

    return client.id;
  }

  const { data: client, error } = await ctx.admin
    .from("clients")
    .insert({
      company_id: ctx.company.id,
      name: payload.clientName,
      contact: payload.clientContact || null,
      email: payload.clientEmail || null,
      address: payload.clientAddress || null,
    })
    .select("id")
    .single();

  if (error || !client) {
    throw new Error(error?.message || "client_create_failed");
  }

  return client.id;
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  const parsed = QuerySchema.safeParse(req.method === "GET" ? req.query : req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_project_id");

  const projectId = parsed.data.id;
  if (!canAccessProject(ctx, projectId)) return sendError(res, 403, "forbidden");

  if (req.method === "GET") {
    const { data: project, error: projectError } = await ctx.admin
      .from("projects")
      .select("id, company_id, client_id, job_number, name, location, start_date, end_date, contract_value")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) return sendError(res, 404, "project_not_found");

    const [{ data: client }, { data: assignments }, taskWorkspace] = await Promise.all([
      ctx.admin
        .from("clients")
        .select("id, name, contact, email, address")
        .eq("id", project.client_id)
        .maybeSingle(),
      ctx.admin
        .from("project_users")
        .select("project_id, user_id, role, hourly_rate")
        .eq("project_id", projectId),
      getTaskWorkspace(ctx.admin, ctx, { projectId }),
    ]);

    const directory = await loadUserDirectory(
      ctx.admin,
      ctx.company.id,
      (assignments ?? []).map((item) => item.user_id)
    );

    const managers = (assignments ?? [])
      .filter((item) => item.role === "manager")
      .map((item) => ({
        ...item,
        staff: directory.get(item.user_id) ?? null,
      }));

    const employees = (assignments ?? [])
      .filter((item) => item.role === "employee")
      .map((item) => ({
        ...item,
        staff: directory.get(item.user_id) ?? null,
      }));

    return sendOk(res, {
      project: {
        ...project,
        client,
        managers,
        employees,
        tasks: taskWorkspace.tasks,
        reports: [],
        expenses: [],
      },
    });
  }

  if (req.method === "PUT") {
    if (ctx.role !== "owner") return sendError(res, 403, "forbidden");

    const updateParsed = UpdateProjectSchema.safeParse(req.body);
    if (!updateParsed.success) return sendError(res, 400, "invalid_payload", updateParsed.error.flatten());

    try {
      const payload = updateParsed.data;
      const clientId = await resolveClientId(ctx, payload);

      const { data: project, error } = await ctx.admin
        .from("projects")
        .update({
          client_id: clientId,
          name: payload.name,
          location: payload.location ?? null,
          start_date: payload.startDate,
          end_date: payload.endDate || null,
          contract_value: payload.contractValue,
        })
        .eq("id", payload.id)
        .eq("company_id", ctx.company.id)
        .select("id, job_number, name, location, start_date, end_date, contract_value")
        .single();

      if (error || !project) return sendError(res, 500, "project_update_failed", error?.message);
      return sendOk(res, { project });
    } catch (error) {
      return sendError(res, 500, "project_update_failed", error.message);
    }
  }

  if (req.method === "DELETE") {
    if (ctx.role !== "owner") return sendError(res, 403, "forbidden");

    const { error } = await ctx.admin
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("company_id", ctx.company.id);

    if (error) return sendError(res, 500, "project_delete_failed", error.message);
    return sendOk(res, { deleted: true });
  }

  return sendError(res, 405, "method_not_allowed");
}
