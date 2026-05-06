import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { buildEstimateComputation } from "@/lib/server/estimating/estimateEngine";

const PreviewPayloadSchema = z.object({
  projectId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  overheadPercent: z.coerce.number().nonnegative().default(0),
  profitPercent: z.coerce.number().nonnegative().default(0),
  commissionPercent: z.coerce.number().nonnegative().default(0),
  riskPercent: z.coerce.number().nonnegative().default(0),
  inflationRate: z.coerce.number().nonnegative().default(0),
  escalationYears: z.coerce.number().nonnegative().default(0),
  lineItems: z.array(z.any()).optional().default([]),
  costCodes: z.array(z.any()).optional().default([]),
});

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (req.method !== "POST") return sendError(res, 405, "method_not_allowed");

  const parsed = PreviewPayloadSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

  try {
    const computed = buildEstimateComputation(parsed.data);
    return sendOk(res, {
      summary: computed.summary,
      costCodes: computed.costCodes,
    });
  } catch (error) {
    return sendError(res, 500, "estimate_preview_failed", error.message);
  }
}
