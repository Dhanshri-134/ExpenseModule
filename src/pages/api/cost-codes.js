import { getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (req.method !== "GET") return sendError(res, 405, "method_not_allowed");

  const { data, error } = await ctx.admin
    .from("cost_codes")
    .select("id, code, name, description")
    .eq("company_id", ctx.company.id)
    .order("code", { ascending: true })
    .limit(500);

  if (error) return sendError(res, 500, "cost_codes_fetch_failed", error.message);
  return sendOk(res, { costCodes: data ?? [] });
}
