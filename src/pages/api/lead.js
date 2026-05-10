import { z } from "zod";
import { canAccessModule, getRequestContext } from "@/lib/server/authz";
import { createFollowUp } from "@/lib/server/followups";
import { sendError, sendOk } from "@/lib/server/responses";

const ConvertLeadSchema = z.object({
  id: z.string().uuid(),
});

async function resolveClientIdFromLead(ctx, lead) {
  const { data: existingClient } = await ctx.admin
    .from("clients")
    .select("id, name, email, contact, address")
    .eq("company_id", ctx.company.id)
    .ilike("name", lead.name)
    .maybeSingle();

  if (existingClient?.id) {
    const { data: client, error } = await ctx.admin
      .from("clients")
      .update({
        name: lead.name,
        address: lead.address,
        contact: lead.contact,
        email: lead.email,
      })
      .eq("id", existingClient.id)
      .select("id, name, email, contact, address")
      .single();

    if (error || !client) throw new Error(error?.message || "client_update_failed");
    return client.id;
  }

  const { data: client, error } = await ctx.admin
    .from("clients")
    .insert({
      company_id: ctx.company.id,
      name: lead.name,
      address: lead.address,
      contact: lead.contact,
      email: lead.email,
    })
    .select("id, name, email, contact, address")
    .single();

  if (error || !client) throw new Error(error?.message || "client_create_failed");
  return client.id;
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (!canAccessModule(ctx, "leads")) return sendError(res, 403, "forbidden");
  if (req.method !== "PUT") return sendError(res, 405, "method_not_allowed");

  const parsed = ConvertLeadSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

  const { data: lead, error: leadError } = await ctx.admin
    .from("leads")
    .select("*")
    .eq("id", parsed.data.id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (leadError || !lead) return sendError(res, 404, "lead_not_found");

  try {
    const clientId = lead.converted_client_id || (await resolveClientIdFromLead(ctx, lead));

    const { data: updatedLead, error: updateError } = await ctx.admin
      .from("leads")
      .update({
        status: "converted",
        converted_client_id: clientId,
        converted_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .eq("company_id", ctx.company.id)
      .select("*")
      .single();

    if (updateError || !updatedLead) return sendError(res, 500, "lead_convert_failed", updateError?.message);

    try {
      await createFollowUp(ctx, {
        refId: lead.id,
        refType: "lead",
        date: new Date().toISOString().slice(0, 10),
        note: "Lead converted to client.",
        status: "done",
      });
    } catch (followUpError) {
      return sendError(res, 500, "lead_followup_create_failed", followUpError.message);
    }

    return sendOk(res, {
      lead: {
        ...lead,
        ...updatedLead,
      },
      clientId,
    });
  } catch (error) {
    return sendError(res, 500, "lead_convert_failed", error.message);
  }
}
