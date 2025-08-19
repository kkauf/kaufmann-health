/**
 * Supabase client placeholder.
 *
 * To enable, install: npm i @supabase/supabase-js
 * Then replace this placeholder to create a browser/server client.
 *
 * Security: Do not expose service role keys in the browser. Use server-side
 * Route Handlers or Edge Functions with HTTP-only cookies for auth tokens.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
    return null;
  }

  if (!client) {
    client = createClient(url, anon, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
