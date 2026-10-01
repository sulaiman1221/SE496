import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Server-side client using the secret key. Bypasses RLS, so it must only be
// used in server components, server actions and route handlers.
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Add them to .env.local.",
    );
  }

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
