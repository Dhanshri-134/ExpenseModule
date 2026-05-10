import { z } from "zod";
import { canAccessModule, getRequestContext } from "@/lib/server/authz";
import { sendError, sendOk } from "@/lib/server/responses";
import { estimateToPdfBuffer } from "@/lib/projectModules";
import { sendEstimateEmail } from "@/lib/server/mailer";
import { composeEstimateRecord, loadEstimateGraph } from "@/lib/server/estimating/estimateEngine";

const SendEstimateSchema = z.object({
  estimateId: z.string().uuid(),
  confirmSend: z.boolean().optional().default(false),
});

function buildEstimateEmailHtml({ estimate, customerName, companyName }) {
  return `
    <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Segoe UI,Arial,sans-serif;color:#102033;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe5f0;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(16,32,51,0.12);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f4c81 0%,#17a2b8 55%,#7dd3fc 100%);color:#ffffff;">
          <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.18);font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            Estimate
          </div>
          <h1 style="margin:16px 0 8px;font-size:28px;line-height:1.2;">${estimate.title || "Estimate"}</h1>
          <p style="margin:0;font-size:15px;line-height:1.7;opacity:0.95;">
            Hello ${customerName || "Customer"}, please find your estimate attached from ${companyName || "our team"}.
          </p>
        </div>
        <div style="padding:32px;">
          <div style="border:1px solid #dbe5f0;border-radius:18px;padding:16px 18px;background:#f8fbff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b7188;">Estimate Number</div>
            <div style="margin-top:6px;font-size:18px;font-weight:700;color:#102033;">#${estimate.estimate_number || "Draft"}</div>
          </div>
          <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#35506a;">
            The attached PDF is the current version prepared for your review.
          </p>
        </div>
      </div>
    </div>
  `;
}

export default async function handler(req, res) {
  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (!canAccessModule(ctx, "estimates")) return sendError(res, 403, "forbidden");
  if (req.method !== "POST") return sendError(res, 405, "method_not_allowed");

  const parsed = SendEstimateSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());
  if (!parsed.data.confirmSend) return sendError(res, 400, "send_confirmation_required");

  const { data: estimate, error: estimateError } = await ctx.admin
    .from("project_estimates")
    .select("*")
    .eq("company_id", ctx.company.id)
    .eq("id", parsed.data.estimateId)
    .maybeSingle();

  if (estimateError || !estimate) return sendError(res, 404, "estimate_not_found");

  const [graph, clientResult, templateResult] = await Promise.all([
    loadEstimateGraph(ctx.admin, [estimate.id]),
    estimate.client_id
      ? ctx.admin.from("clients").select("id, name, contact, email, address").eq("id", estimate.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    estimate.template_id
      ? ctx.admin.from("estimate_templates").select("id, name, configuration").eq("id", estimate.template_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const composedEstimate = composeEstimateRecord(estimate, graph.get(estimate.id) ?? []);
  const enrichedEstimate = {
    ...composedEstimate,
    client: clientResult.data || null,
    template: templateResult.data || null,
  };

  const customer = enrichedEstimate.summary?.documentMeta?.customer || {};
  const company = enrichedEstimate.summary?.documentMeta?.company || {};
  const recipientEmail = customer.email || enrichedEstimate.client?.email || "";
  if (!recipientEmail) return sendError(res, 400, "customer_email_required");

  const pdfBuffer = await estimateToPdfBuffer(enrichedEstimate);
  const subject = `${enrichedEstimate.title || "Estimate"} from ${company.name || ctx.company.name}`;
  const text = [
    `Hello ${customer.name || enrichedEstimate.client?.name || "Customer"},`,
    "",
    `Please find attached ${enrichedEstimate.title || "your estimate"}.`,
    "",
    `Estimate Number: #${enrichedEstimate.estimate_number || "Draft"}`,
    `Company: ${company.name || ctx.company.name}`,
  ].join("\n");

  try {
    await sendEstimateEmail({
      to: recipientEmail,
      subject,
      text,
      html: buildEstimateEmailHtml({
        estimate: enrichedEstimate,
        customerName: customer.name || enrichedEstimate.client?.name || "",
        companyName: company.name || ctx.company.name,
      }),
      pdfBuffer,
      filename: `estimate-${enrichedEstimate.estimate_number || "draft"}.pdf`,
    });

    const { error: updateError } = await ctx.admin
      .from("project_estimates")
      .update({
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", enrichedEstimate.id);

    if (updateError) return sendError(res, 500, "estimate_status_update_failed", updateError.message);

    return sendOk(res, { sent: true });
  } catch (error) {
    return sendError(res, 500, "estimate_send_failed", error.message);
  }
}
