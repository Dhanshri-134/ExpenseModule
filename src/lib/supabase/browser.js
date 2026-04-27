"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";

let browserClient;

export function getSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  if (browserClient) return browserClient;
  browserClient = createBrowserClient(config.url, config.anonKey);
  return browserClient;
}
