import { createSupabasePagesServerClient } from "@/lib/pages/supabaseServerClient";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const supabase = createSupabasePagesServerClient(req, res);
  if (!supabase) return res.status(500).json({ ok: false, error: "supabase_not_configured" });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return res.status(401).json({ ok: false, error: "unauthenticated" });

  const user = userData.user;

  const { data: companyUsers } = await supabase
    .from("company_users")
    .select("company_id,role,user_code,user_name,role_number,hourly_rate,created_in_project_id")
    .eq("user_id", user.id);

  const { data: projectUsers } = await supabase
    .from("project_users")
    .select("project_id,role,hourly_rate")
    .eq("user_id", user.id);

  return res.status(200).json({
    ok: true,
    user: { id: user.id, email: user.email, userName: user.user_metadata?.user_name || "" },
    company_users: companyUsers ?? [],
    project_users: projectUsers ?? [],
  });
}
