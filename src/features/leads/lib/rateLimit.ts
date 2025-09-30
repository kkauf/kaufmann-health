/* eslint-disable @typescript-eslint/no-explicit-any */
// Therapist-aware rate limiting. Patients check `people` table by IP in metadata
// (same as before). Therapists additionally check `therapist_contracts` by
// hashed IP (sha256 over `${IP_HASH_SALT}${ip}`) written at insert time.
import { hashIP } from './validation';

export async function isIpRateLimited(
  supabase: any,
  ip: string,
  leadType: 'patient' | 'therapist' | undefined = undefined,
  windowMs = 60_000,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  // Always check `people` for backward compatibility and patient submissions
  try {
    const { data, error } = await supabase
      .from('people')
      .select('id, created_at')
      .contains('metadata', { ip })
      .gte('created_at', cutoff)
      .limit(1);
    if (!error && Array.isArray(data) && data.length > 0) return true;
  } catch {
    // ignore
  }

  if (leadType === 'therapist') {
    try {
      const hashed = hashIP(ip);
      const { data, error } = await supabase
        .from('therapist_contracts')
        .select('id, created_at')
        .eq('ip_address', hashed)
        .gte('created_at', cutoff)
        .limit(1);
      if (!error && Array.isArray(data) && data.length > 0) return true;
    } catch {
      // ignore
    }
  }

  return false;
}
