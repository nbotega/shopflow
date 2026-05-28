import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client com SERVICE_ROLE_KEY.
 * BYPASSA RLS — usar SOMENTE em route handlers / server actions,
 * NUNCA expor ao browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
