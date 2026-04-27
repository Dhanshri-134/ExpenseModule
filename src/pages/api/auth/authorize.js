import { z } from "zod";
import { ALLOWED_ROLES, normalizeRole } from "@/lib/roles";
import { createSupabasePagesServerClient } from "@/lib/pages/supabaseServerClient";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({ role: z.string().min(1) });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const supabase = createSupabasePagesServerClient(req, res);
  if (!supabase) return res.status(500).json({ ok: false, error: "supabase_not_configured" });

  const admin = getSupabaseAdminClient();
  if (!admin) return res.status(500).json({ ok: false, error: "supabase_admin_not_configured" });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "bad_request" });

  const role = normalizeRole(parsed.data.role);
  if (!ALLOWED_ROLES.has(role)) return res.status(400).json({ ok: false, error: "invalid_role" });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return res.status(401).json({ ok: false, error: "unauthenticated" });

  const userId = userData.user.id;
  if (role === "owner") {
    const { data } = await admin
      .from("company_users")
      .select("role, company_id")
      .eq("user_id", userId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (!data) return res.status(403).json({ ok: false, error: "forbidden" });
    return res.status(200).json({ ok: true, role, company_id: data.company_id });
  }

  const { data } = await admin
    .from("project_users")
    .select("role, project_id, hourly_rate")
    .eq("user_id", userId)
    .eq("role", role)
    .limit(1)
    .maybeSingle();

  if (!data) return res.status(403).json({ ok: false, error: "forbidden" });
  return res.status(200).json({
    ok: true,
    role,
    project_id: data.project_id,
    hourly_rate: data.hourly_rate,
  });
}
