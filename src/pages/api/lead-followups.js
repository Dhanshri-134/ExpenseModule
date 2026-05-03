import { z } from "zod";
import { createFollowUp, listFollowUps } from "@/lib/server/followups";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";

const QuerySchema = z.object({
  leadId: z.string().uuid(),
});

const CreateFollowUpSchema = z.object({
  leadId: z.string().uuid(),
  note: z.string().trim().min(1),
  nextFollowUpDate: z.string().min(1),
  status: z.enum(["pending", "done"]).optional().nullable(),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, "invalid_lead_id");

    try {
      const followUps = await listFollowUps(ctx, {
        refType: "lead",
        refId: parsed.data.leadId,
      });

      return sendOk(res, {
        followUps: followUps.map((item) => ({
          ...item,
          lead_id: item.ref_id,
          next_follow_up_date: item.date,
          created_by_user_id: item.created_by,
        })),
      });
    } catch (error) {
      return sendError(res, 500, "lead_followups_fetch_failed", error.message);
    }
  }

  if (req.method === "POST") {
    const parsed = CreateFollowUpSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    try {
      const followUp = await createFollowUp(ctx, {
        refId: parsed.data.leadId,
        refType: "lead",
        date: parsed.data.nextFollowUpDate,
        note: parsed.data.note,
        status: parsed.data.status ?? "pending",
      });

      return sendOk(res, {
        followUp: {
          ...followUp,
          lead_id: followUp.ref_id,
          next_follow_up_date: followUp.date,
          created_by_user_id: followUp.created_by,
        },
      });
    } catch (error) {
      const status = error.message === "forbidden" ? 403 : error.message?.endsWith("_not_found") ? 404 : 500;
      return sendError(res, status, error.message || "lead_followup_create_failed", error.message);
    }
  }

  return sendError(res, 405, "method_not_allowed");
}
