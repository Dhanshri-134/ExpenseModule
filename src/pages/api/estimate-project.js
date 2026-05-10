import { z } from "zod";
import { canAccessModule, getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";

const Schema = z.object({
  estimateId: z.string().uuid(),
  name: z.string().trim().min(1),
  clientId: z.string().uuid().optional().nullable(),
  clientName: z.string().trim().optional().nullable(),
  clientContact: z.string().trim().optional().nullable(),
  clientEmail: z.union([z.string().email(), z.literal("")]).optional().nullable(),
  clientAddress: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().default(""),
  startDate: z.string().trim().optional().default(""),
  endDate: z.string().trim().optional().default(""),
});

async function resolveClientId(ctx, estimate, payload) {
  if (payload.clientId) return payload.clientId;
  if (String(payload.clientName || "").trim()) {
    const { data: existingClient } = await ctx.admin
      .from("clients")
      .select("id")
      .eq("company_id", ctx.company.id)
      .ilike("name", payload.clientName.trim())
      .maybeSingle();

    if (existingClient?.id) {
      const { data: updatedClient, error } = await ctx.admin
        .from("clients")
        .update({
          name: payload.clientName.trim(),
          contact: payload.clientContact || null,
          email: payload.clientEmail || null,
          address: payload.clientAddress || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingClient.id)
        .eq("company_id", ctx.company.id)
        .select("id")
        .single();

      if (error || !updatedClient) throw new Error(error?.message || "client_update_failed");
      return updatedClient.id;
    }

    const { data: client, error } = await ctx.admin
      .from("clients")
      .insert({
        company_id: ctx.company.id,
        name: payload.clientName.trim(),
        contact: payload.clientContact || null,
        email: payload.clientEmail || null,
        address: payload.clientAddress || null,
      })
      .select("id")
      .single();

    if (error || !client) throw new Error(error?.message || "client_create_failed");
    return client.id;
  }

  if (estimate.client_id) return estimate.client_id;
  throw new Error("client_required");
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (!canAccessModule(ctx, "estimates") || !canAccessModule(ctx, "projects")) return sendError(res, 403, "forbidden");
  if (req.method !== "POST") return sendError(res, 405, "method_not_allowed");

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

  const { data: estimate, error: estimateError } = await ctx.admin
    .from("project_estimates")
    .select("*, clients:client_id (id, name)")
    .eq("company_id", ctx.company.id)
    .eq("id", parsed.data.estimateId)
    .maybeSingle();

  if (estimateError || !estimate) return sendError(res, 404, "estimate_not_found");
  if (estimate.created_project_id) return sendError(res, 400, "project_already_created");

  let clientId;
  try {
    clientId = await resolveClientId(ctx, estimate, parsed.data);
  } catch (error) {
    return sendError(res, 400, error.message, error.message);
  }

  const { data: project, error: projectError } = await ctx.admin
    .from("projects")
    .insert({
      company_id: ctx.company.id,
      client_id: clientId,
      name: parsed.data.name,
      location: parsed.data.location || null,
      start_date: parsed.data.startDate || null,
      end_date: parsed.data.endDate || null,
      contract_value: Number(estimate.summary?.finalBid || estimate.summary?.totalPrice || 0),
    })
    .select("id, name, location, start_date, end_date, contract_value")
    .single();

  if (projectError || !project) return sendError(res, 500, "project_create_failed", projectError?.message);

  const { error: linkError } = await ctx.admin
    .from("project_estimates")
    .update({
      project_id: project.id,
      created_project_id: project.id,
      status: "project_created",
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimate.id);

  if (linkError) return sendError(res, 500, "estimate_project_link_failed", linkError.message);

  return sendOk(res, { project });
}
