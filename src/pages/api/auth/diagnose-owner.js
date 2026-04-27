import { createSupabasePagesServerClient } from "@/lib/pages/supabaseServerClient";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const supabase = createSupabasePagesServerClient(req, res);
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "supabase_not_configured" });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return res
      .status(500)
      .json({ ok: false, error: "supabase_admin_not_configured" });
  }

  const user = userData.user;

  const { data: ownerMembership } = await admin
    .from("company_users")
    .select("company_id, role, user_code")
    .eq("user_id", user.id)
    .eq("role", "owner");

  const { data: ownedCompanies } = await admin
    .from("companies")
    .select("id,code,name,owner_user_id")
    .eq("owner_user_id", user.id);

  return res.status(200).json({
    ok: true,
    user: { id: user.id, email: user.email },
    company_users_owner_rows: ownerMembership ?? [],
    companies_owned: ownedCompanies ?? [],
    fix_sql:
      "insert into public.company_users (company_id, user_id, role)\nselect c.id, c.owner_user_id, 'owner'\nfrom public.companies c\nwhere c.owner_user_id = '<OWNER_AUTH_UID>'\n  and not exists (\n    select 1 from public.company_users cu\n    where cu.company_id = c.id and cu.user_id = c.owner_user_id and cu.role = 'owner'\n  );",
  });
}

