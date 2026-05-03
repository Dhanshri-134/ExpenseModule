import { z } from "zod";
import {
  createFollowUp,
  deleteFollowUp,
  FOLLOW_UP_REF_TYPES,
  FOLLOW_UP_STATUSES,
  FollowUpInputSchema,
  listFollowUps,
  updateFollowUp,
} from "@/lib/server/followups";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";

const FollowUpQuerySchema = z.object({
  refId: z.string().uuid().optional(),
  refType: z.enum(FOLLOW_UP_REF_TYPES).optional(),
  filter: z.enum(["today", "upcoming", "completed", "all"]).optional(),
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
});

const UpdateFollowUpSchema = z.object({
  id: z.string().uuid(),
  date: z.string().min(1),
  note: z.string().trim().min(1),
  status: z.enum(FOLLOW_UP_STATUSES),
});

const DeleteFollowUpSchema = z.object({
  id: z.string().uuid(),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);

  if (req.method === "GET") {
    const parsed = FollowUpQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) return sendError(res, 400, "invalid_query", parsed.error.flatten());

    try {
      const followUps = await listFollowUps(ctx, {
        refId: parsed.data.refId ?? null,
        refType: parsed.data.refType ?? null,
        filter: parsed.data.filter && parsed.data.filter !== "all" ? parsed.data.filter : null,
        status: parsed.data.status ?? null,
      });

      return sendOk(res, { followUps });
    } catch (error) {
      return sendError(res, 500, "followups_fetch_failed", error.message);
    }
  }

  if (req.method === "POST") {
    const parsed = FollowUpInputSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    try {
      const followUp = await createFollowUp(ctx, parsed.data);
      return sendOk(res, { followUp });
    } catch (error) {
      const status = error.message === "forbidden" ? 403 : error.message?.endsWith("_not_found") ? 404 : 500;
      return sendError(res, status, error.message || "followup_create_failed", error.message);
    }
  }

  if (req.method === "PUT") {
    const parsed = UpdateFollowUpSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    try {
      const followUp = await updateFollowUp(ctx, parsed.data.id, parsed.data);
      return sendOk(res, { followUp });
    } catch (error) {
      const status = error.message === "forbidden" ? 403 : error.message?.endsWith("_not_found") ? 404 : 500;
      return sendError(res, status, error.message || "followup_update_failed", error.message);
    }
  }

  if (req.method === "DELETE") {
    const parsed = DeleteFollowUpSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

    try {
      const result = await deleteFollowUp(ctx, parsed.data.id);
      return sendOk(res, result);
    } catch (error) {
      const status = error.message === "forbidden" ? 403 : error.message?.endsWith("_not_found") ? 404 : 500;
      return sendError(res, status, error.message || "followup_delete_failed", error.message);
    }
  }

  return sendError(res, 405, "method_not_allowed");
}
