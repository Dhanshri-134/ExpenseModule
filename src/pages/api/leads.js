import { z } from "zod";
import { sendError, sendOk, rejectMethod } from "@/lib/server/responses";
import { createFollowUp } from "@/lib/server/followups";
import { buildPaginationMeta, parsePaginationParams } from "@/shared/services/api/pagination";
import { requireApiContext } from "@/shared/services/security/request";

const LeadSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().optional().nullable().default(""),
  contact: z.string().trim().optional().nullable().default(""),
  email: z.union([z.string().trim().email(), z.literal(""), z.null(), z.undefined()]).default(""),
  followUpDate: z.string().optional().nullable(),
  followUpNote: z.string().trim().optional().nullable(),
  followUpStatus: z.enum(["pending", "done"]).optional().nullable(),
});

const UpdateLeadSchema = LeadSchema.pick({
  name: true,
  address: true,
  contact: true,
  email: true,
}).extend({
  id: z.string().uuid(),
});

const DeleteLeadSchema = z.object({
  id: z.string().uuid(),
});

export default async function handler(req, res) {
  const ctx = await requireApiContext(req, res, { moduleKey: "leads" });
  if (!ctx) return;

  if (req.method === "GET") {
    const pagination = parsePaginationParams(req.query, { pageSize: 20, maxPageSize: 100 });
    let leadsQuery = ctx.admin
      .from("leads")
      .select("*", pagination.enabled ? { count: "exact" } : {})
      .eq("company_id", ctx.company.id)
      .order("created_at", { ascending: false });

    if (pagination.enabled) {
      leadsQuery = leadsQuery.range(pagination.from, pagination.to);
    }

    const { data: leads, error, count } = await leadsQuery;

    if (error) return sendError(res, 500, "leads_fetch_failed", error.message);

    const leadIds = (leads ?? []).map((lead) => lead.id);
    const { data: followUps, error: followUpError } = leadIds.length
      ? await ctx.admin
          .from("followups")
          .select("*")
          .eq("company_id", ctx.company.id)
          .eq("ref_type", "lead")
          .in("ref_id", leadIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (followUpError) return sendError(res, 500, "lead_followups_fetch_failed", followUpError.message);

    const followUpMetaByLeadId = new Map();
    for (const followUp of followUps ?? []) {
      if (!followUpMetaByLeadId.has(followUp.ref_id)) {
        followUpMetaByLeadId.set(followUp.ref_id, {
          followUpCount: 0,
          latestFollowUpAt: followUp.created_at,
          nextFollowUpDate: followUp.status !== "done" ? followUp.date || "" : "",
        });
      }
      const current = followUpMetaByLeadId.get(followUp.ref_id);
      current.followUpCount += 1;
      if ((!current.nextFollowUpDate || followUp.date < current.nextFollowUpDate) && followUp.status !== "done") {
        current.nextFollowUpDate = followUp.date;
      }
    }

    return sendOk(res, {
      leads: (leads ?? []).map((lead) => ({
        ...lead,
        followUpCount: followUpMetaByLeadId.get(lead.id)?.followUpCount ?? 0,
        latestFollowUpAt: followUpMetaByLeadId.get(lead.id)?.latestFollowUpAt ?? "",
        nextFollowUpDate: followUpMetaByLeadId.get(lead.id)?.nextFollowUpDate ?? "",
      })),
      ...(pagination.enabled ? { pagination: buildPaginationMeta(count ?? 0, pagination) } : {}),
    });
  }

  if (req.method === "POST") {
    const parsed = LeadSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const payload = parsed.data;
    const { data: lead, error } = await ctx.admin
      .from("leads")
      .insert({
        company_id: ctx.company.id,
        name: payload.name,
        address: payload.address || "",
        contact: payload.contact || "",
        email: payload.email || "",
      })
      .select("*")
      .single();

    if (error || !lead) return sendError(res, 500, "lead_create_failed", error?.message);

    if (payload.followUpDate && payload.followUpNote) {
      try {
        await createFollowUp(ctx, {
          refId: lead.id,
          refType: "lead",
          date: payload.followUpDate,
          note: payload.followUpNote,
          status: payload.followUpStatus ?? "pending",
        });
      } catch (followUpError) {
        return sendError(res, 500, "lead_followup_create_failed", followUpError.message);
      }
    }

    return sendOk(res, {
      lead: {
        ...lead,
        followUpCount: payload.followUpDate && payload.followUpNote ? 1 : 0,
        latestFollowUpAt: payload.followUpDate && payload.followUpNote ? lead.created_at : "",
        nextFollowUpDate: payload.followUpDate ?? "",
      },
    });
  }

  if (req.method === "PUT") {
    const parsed = UpdateLeadSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const { id, ...payload } = parsed.data;
    const { data: lead, error } = await ctx.admin
      .from("leads")
      .update({
        name: payload.name,
        address: payload.address || "",
        contact: payload.contact || "",
        email: payload.email || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .select("*")
      .single();

    if (error || !lead) return sendError(res, 500, "lead_update_failed", error?.message);

    return sendOk(res, { lead });
  }

  if (req.method === "DELETE") {
    if (ctx.role !== "owner") return sendError(res, 403, "forbidden");

    const parsed = DeleteLeadSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    const { error } = await ctx.admin
      .from("leads")
      .delete()
      .eq("id", parsed.data.id)
      .eq("company_id", ctx.company.id);

    if (error) return sendError(res, 500, "lead_delete_failed", error.message);

    return sendOk(res, { deleted: true });
  }

  return rejectMethod(res, ["GET", "POST", "PUT", "DELETE"]);
}
