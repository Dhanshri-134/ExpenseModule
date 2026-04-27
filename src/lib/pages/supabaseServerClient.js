import { createServerClient } from "@supabase/ssr";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function parseCookies(cookieHeader) {
  const out = [];
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (name) out.push({ name, value });
  }
  return out;
}

function setAllCookies(res, cookiesToSet, headers) {
  const setCookie = cookiesToSet.map(({ name, value, options }) => {
    const attrs = [];
    attrs.push(`${name}=${value}`);
    if (options?.maxAge != null) attrs.push(`Max-Age=${options.maxAge}`);
    if (options?.expires) attrs.push(`Expires=${options.expires.toUTCString()}`);
    if (options?.path) attrs.push(`Path=${options.path}`);
    if (options?.domain) attrs.push(`Domain=${options.domain}`);
    if (options?.sameSite) attrs.push(`SameSite=${options.sameSite}`);
    if (options?.secure) attrs.push("Secure");
    if (options?.httpOnly) attrs.push("HttpOnly");
    return attrs.join("; ");
  });
  if (setCookie.length) res.setHeader("Set-Cookie", setCookie);
  Object.entries(headers || {}).forEach(([k, v]) => res.setHeader(k, v));
}

export function createSupabasePagesServerClient(req, res) {
  const config = getSupabaseConfig();
  if (!config) return null;

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return parseCookies(req.headers.cookie);
      },
      setAll(cookiesToSet, headers) {
        setAllCookies(res, cookiesToSet, headers);
      },
    },
  });
}

