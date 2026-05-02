import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({ loginId: z.string().min(1) });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "supabase_admin_not_configured" });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "bad_request" });

  const loginId = parsed.data.loginId.trim();
  if (loginId.includes("@")) return res.status(200).json({ ok: true, type: "email", email: loginId });

  const { data: codeMatch } = await supabaseAdmin
    .from("company_users")
    .select("user_id, user_code, user_name")
    .eq("user_code", loginId)
    .limit(1)
    .maybeSingle();

  const { data } = codeMatch?.user_id
    ? { data: codeMatch }
    : await supabaseAdmin
        .from("company_users")
        .select("user_id, user_code, user_name")
        .ilike("user_name", loginId)
        .limit(1)
        .maybeSingle();

  if (!data?.user_id) return res.status(404).json({ ok: false, error: "not_found" });

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
  if (!userData?.user?.email) return res.status(404).json({ ok: false, error: "not_found" });

  return res.status(200).json({
    ok: true,
    type: data.user_code === loginId ? "user_code" : "user_name",
    email: userData.user.email,
  });
}
