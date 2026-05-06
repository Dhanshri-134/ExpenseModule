import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";

const Schema = z.object({
  estimateId: z.string().uuid(),
  name: z.string().trim().min(1),
  location: z.string().trim().optional().default(""),
  startDate: z.string().trim().optional().default(""),
  endDate: z.string().trim().optional().default(""),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
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
  if (estimate.invoice_status !== "completed") return sendError(res, 400, "invoice_not_completed");
  if (estimate.created_project_id) return sendError(res, 400, "project_already_created");

  const { data: project, error: projectError } = await ctx.admin
    .from("projects")
    .insert({
      company_id: ctx.company.id,
      client_id: estimate.client_id || null,
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
