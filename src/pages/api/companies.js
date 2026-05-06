import { createSupabasePagesServerClient } from "@/lib/pages/supabaseServerClient";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const supabase = createSupabasePagesServerClient(req, res);
  if (!supabase) return res.status(500).json({ ok: false, error: "supabase_not_configured" });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return res.status(401).json({ ok: false, error: "unauthenticated" });

  const { data, error } = await supabase
    .from("companies")
    .select("id,name,code,owner_user_id,address,contact,email,metadata,created_at")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ ok: false, error: "db_error" });
  return res.status(200).json({ ok: true, companies: data ?? [] });
}
