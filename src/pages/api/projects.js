import { z } from "zod";
import { canAccessProject, getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  clientName: z.string().min(1),
  clientContact: z.string().optional().nullable(),
  clientEmail: z.union([z.string().email(), z.literal("")]).optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  contractValue: z.coerce.number().nonnegative().default(0),
});

async function upsertClient(ctx, payload) {
  const clientRecord = {
    company_id: ctx.company.id,
    name: payload.clientName,
    contact: payload.clientContact || null,
    email: payload.clientEmail || null,
    address: payload.clientAddress || null,
  };

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
        name: clientRecord.name,
        contact: clientRecord.contact,
        email: clientRecord.email,
        address: clientRecord.address,
      })
      .eq("id", existingClient.id)
      .select("id")
      .single();

    if (error || !client) throw new Error(error?.message || "client_update_failed");
    return client.id;
  }

  const { data: client, error: clientError } = await ctx.admin
    .from("clients")
    .insert(clientRecord)
    .select("id")
    .single();

  if (clientError || !client) throw new Error(clientError?.message || "client_create_failed");
  return client.id;
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const { data: projects, error } = await ctx.admin
      .from("projects")
      .select("id, company_id, client_id, job_number, name, location, start_date, end_date, contract_value, created_at")
      .eq("company_id", ctx.company.id)
      .order("created_at", { ascending: false });

    if (error) return sendError(res, 500, "projects_fetch_failed");

    const visibleProjects = (projects ?? []).filter((project) => canAccessProject(ctx, project.id));
    const clientIds = [...new Set(visibleProjects.map((item) => item.client_id).filter(Boolean))];
    const { data: clients } = clientIds.length
      ? await ctx.admin.from("clients").select("id, name, email, contact, address").in("id", clientIds)
      : { data: [] };

    const enriched = visibleProjects.map((project) => ({
      ...project,
      client: (clients ?? []).find((client) => client.id === project.client_id) || null,
    }));

    return sendOk(res, { projects: enriched });
  }

  if (req.method === "POST") {
    if (ctx.role !== "owner") return sendError(res, 403, "forbidden");

    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const payload = parsed.data;

    try {
      const clientId = await upsertClient(ctx, payload);

      const { data: project, error: projectError } = await ctx.admin
        .from("projects")
        .insert({
          company_id: ctx.company.id,
          client_id: clientId,
          name: payload.name,
          location: payload.location,
          start_date: payload.startDate,
          end_date: payload.endDate || null,
          contract_value: payload.contractValue,
        })
        .select("id, job_number, name, location, start_date, end_date, contract_value")
        .single();

      if (projectError || !project) return sendError(res, 500, "project_create_failed", projectError?.message);

      return sendOk(res, { project });
    } catch (error) {
      return sendError(res, 500, "project_create_failed", error.message);
    }
  }

  return sendError(res, 405, "method_not_allowed");
}
