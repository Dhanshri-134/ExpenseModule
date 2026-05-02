import { z } from "zod";
import { listAuthUsersCached } from "@/lib/server/authUsers";
import { sendUsernameRecoveryOtpEmail } from "@/lib/server/mailer";
import { createUsernameRecoveryOtp, verifyUsernameRecoveryOtp } from "@/lib/server/usernameRecovery";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const RequestSchema = z.object({
  action: z.enum(["request", "verify"]),
  role: z.enum(["owner", "manager", "employee"]),
  email: z.string().email(),
  otp: z.string().length(6).optional(),
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return res.status(500).json({ ok: false, error: "supabase_admin_not_configured" });
  }

  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "bad_request" });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const role = parsed.data.role;

  if (parsed.data.action === "verify") {
    const verified = verifyUsernameRecoveryOtp({
      email,
      role,
      otp: parsed.data.otp || "",
    });

    if (!verified.ok) {
      return res.status(400).json({ ok: false, error: verified.error });
    }

    return res.status(200).json({
      ok: true,
      userName: verified.userName,
      userCode: verified.userCode,
    });
  }

  const authUsers = await listAuthUsersCached(admin);
  const authUser = authUsers.find((item) => item.email?.toLowerCase() === email);

  if (!authUser?.id) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }

  const { data: membership } = await admin
    .from("company_users")
    .select("user_id, role, user_code, user_name")
    .eq("user_id", authUser.id)
    .eq("role", role)
    .limit(1)
    .maybeSingle();

  if (!membership?.user_id) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }

  const userName = membership.user_name || membership.user_code;
  const { otp } = createUsernameRecoveryOtp({
    email,
    role,
    userId: membership.user_id,
    userName,
    userCode: membership.user_code,
  });

  await sendUsernameRecoveryOtpEmail({
    email,
    name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || userName,
    otp,
    role,
  });

  return res.status(200).json({
    ok: true,
    sent: true,
  });
}
