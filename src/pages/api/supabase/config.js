export default function handler(_req, res) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  res.status(200).json({
    ok: true,
    configured: Boolean(url && anonKey),
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
  });
}

