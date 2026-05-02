import { createServerClient } from "@supabase/ssr";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function safeNextPath(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/")) return "/";
  return value;
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

export default function AuthCallbackPage() {
  return null;
}

export async function getServerSideProps(ctx) {
  const config = getSupabaseConfig();
  const next = safeNextPath(ctx.query.next || "/");
  const code = typeof ctx.query.code === "string" ? ctx.query.code : null;
  const tokenHash = typeof ctx.query.token_hash === "string" ? ctx.query.token_hash : null;
  const type = typeof ctx.query.type === "string" ? ctx.query.type : null;

  if (!config || (!code && !tokenHash)) {
    return { redirect: { destination: next, permanent: false } };
  }

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return parseCookies(ctx.req.headers.cookie);
      },
      setAll(cookiesToSet, headers) {
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
        if (setCookie.length) ctx.res.setHeader("Set-Cookie", setCookie);
        Object.entries(headers || {}).forEach(([k, v]) => ctx.res.setHeader(k, v));
      },
    },
  });

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
  }

  return { redirect: { destination: next, permanent: false } };
}
