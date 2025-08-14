/**
 * Supabase client placeholder.
 *
 * To enable, install: npm i @supabase/supabase-js
 * Then replace this placeholder to create a browser/server client.
 *
 * Security: Do not expose service role keys in the browser. Use server-side
 * Route Handlers or Edge Functions with HTTP-only cookies for auth tokens.
 */
export function getSupabaseClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
    return null as unknown as any;
  }
  // TODO: import { createClient } from '@supabase/supabase-js' and return an instance
  return null as unknown as any;
}
