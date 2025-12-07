import { supabaseServer } from '@/lib/supabase-server';
import { BASE_URL } from '@/lib/constants';

// Generate a short code (6 chars, alphanumeric, no ambiguous chars)
function generateCode(length = 6): string {
  // Exclude ambiguous chars: 0, O, l, I, 1
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export type CreateShortLinkParams = {
  targetUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  patientId?: string;
};

/**
 * Creates a short link for the given URL.
 * Returns the short URL (e.g., https://kaufmann.health/s/abc123)
 */
export async function createShortLink(params: CreateShortLinkParams): Promise<string | null> {
  const { targetUrl, utmSource, utmMedium, utmCampaign, patientId } = params;

  // Try up to 3 times in case of code collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    
    const { data, error } = await supabaseServer
      .from('short_links')
      .insert({
        code,
        target_url: targetUrl,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        patient_id: patientId || null,
      })
      .select('code')
      .single();

    if (!error && data) {
      return `${BASE_URL}/s/${data.code}`;
    }

    // If unique constraint violation, try again with new code
    if (error?.code === '23505') {
      continue;
    }

    // Other error, log and return null
    console.error('[short-links] Failed to create short link:', error);
    return null;
  }

  console.error('[short-links] Failed to create short link after 3 attempts');
  return null;
}

/**
 * Creates a short link or falls back to the full URL if creation fails.
 * This ensures SMS sending doesn't fail if short link creation has issues.
 */
export async function createShortLinkOrFallback(params: CreateShortLinkParams): Promise<string> {
  const shortUrl = await createShortLink(params);
  if (shortUrl) {
    return shortUrl;
  }
  
  // Fallback: return original URL with UTM params
  try {
    const url = new URL(params.targetUrl);
    if (params.utmSource) url.searchParams.set('utm_source', params.utmSource);
    if (params.utmMedium) url.searchParams.set('utm_medium', params.utmMedium);
    if (params.utmCampaign) url.searchParams.set('utm_campaign', params.utmCampaign);
    return url.toString();
  } catch {
    return params.targetUrl;
  }
}
