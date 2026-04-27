import { z } from "zod";
import { getRequestContext } from "@/lib/server/authz";
import { findDemoCredentialByUserId, touchDemoCredentialSentAt, upsertDemoCredential } from "@/lib/server/demoCredentials";
import { sendCredentialsEmail } from "@/lib/server/mailer";
import { sendError, sendOk } from "@/lib/server/responses";
import { makeTemporaryPassword } from "@/lib/server/users";

const BodySchema = z.object({
  userId: z.string().uuid(),
});

export default async function handler(req, res) {
  if (req.method !== "POST") return sendError(res, 405, "method_not_allowed");

  const ctx = await getRequestContext(req, res);
  if (!ctx.ok) return sendError(res, ctx.status, ctx.error);
  if (ctx.role !== "owner") return sendError(res, 403, "forbidden");

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "invalid_payload", parsed.error.flatten());

  const { data: staff, error: staffError } = await ctx.admin
    .from("company_users")
    .select("user_id, user_code, role, person_id")
    .eq("company_id", ctx.company.id)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (staffError || !staff) return sendError(res, 404, "staff_not_found");

  const { data: person } = await ctx.admin
    .from("people")
    .select("name, email")
    .eq("id", staff.person_id)
    .maybeSingle();

  const { data: authUserResponse, error: authUserError } = await ctx.admin.auth.admin.getUserById(staff.user_id);
  if (authUserError) return sendError(res, 500, "staff_fetch_failed", authUserError.message);

  const authUser = authUserResponse?.user ?? null;
  const credential = findDemoCredentialByUserId(staff.user_id);
  const email = credential?.email || person?.email || authUser?.email || "";
  let password = credential?.password || "";

  if (!email) {
    return sendError(res, 404, "staff_email_not_found");
  }

  if (!password) {
    password = makeTemporaryPassword();
    const { error: passwordError } = await ctx.admin.auth.admin.updateUserById(staff.user_id, {
      email,
      password,
      email_confirm: true,
    });

    if (passwordError) {
      return sendError(res, 500, "credential_reset_failed", passwordError.message);
    }

    upsertDemoCredential({
      userId: staff.user_id,
      companyId: ctx.company.id,
      email,
      password,
      userCode: staff.user_code,
      password_sent_at: credential?.password_sent_at || null,
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.origin || "http://localhost:3000";
  const loginUrl = `${siteUrl.replace(/\/$/, "")}/login`;

  try {
    const delivery = await sendCredentialsEmail({
      email,
      name: person?.name || staff.user_code,
      userCode: staff.user_code,
      password,
      loginUrl,
    });

    touchDemoCredentialSentAt(staff.user_id);

    return sendOk(res, { delivery });
  } catch (error) {
    return sendError(res, 500, "smtp_email_failed", error.message);
  }
}
