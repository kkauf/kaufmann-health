/**
 * Resend Audience Management
 *
 * Manages therapist email lists for product updates and broadcasts.
 * Uses Resend's Audiences API (note: being migrated to "Segments" but API is same).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_BASE_URL = 'https://api.resend.com';

// Audience ID for verified therapists - set via env or created on first use
let THERAPIST_AUDIENCE_ID = process.env.RESEND_THERAPIST_AUDIENCE_ID || '';

interface ResendAudience {
  id: string;
  name: string;
  created_at: string;
}

interface ResendContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
  unsubscribed: boolean;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

async function resendFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  if (!RESEND_API_KEY) {
    return { data: null, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const resp = await fetch(`${RESEND_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      return { data: null, error: `Resend API error ${resp.status}: ${body}` };
    }

    const data = await resp.json();
    return { data, error: null };
  } catch (e) {
    const err = e as Error;
    return { data: null, error: err.message };
  }
}

/**
 * List all audiences in the Resend account.
 */
export async function listAudiences(): Promise<ApiResponse<ResendAudience[]>> {
  const result = await resendFetch<{ data: ResendAudience[] }>('/audiences');
  if (result.error) return { data: null, error: result.error };
  return { data: result.data?.data || [], error: null };
}

/**
 * Create a new audience.
 */
export async function createAudience(name: string): Promise<ApiResponse<ResendAudience>> {
  return resendFetch<ResendAudience>('/audiences', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

/**
 * Get or create the therapist audience.
 * Returns the audience ID.
 */
export async function getOrCreateTherapistAudience(): Promise<ApiResponse<string>> {
  // If we have a cached ID, use it
  if (THERAPIST_AUDIENCE_ID) {
    return { data: THERAPIST_AUDIENCE_ID, error: null };
  }

  // List existing audiences
  const listResult = await listAudiences();
  if (listResult.error) return { data: null, error: listResult.error };

  // Look for existing "Verified Therapists" audience
  const existing = listResult.data?.find(a => a.name === 'Verified Therapists');
  if (existing) {
    THERAPIST_AUDIENCE_ID = existing.id;
    return { data: existing.id, error: null };
  }

  // Create new audience
  const createResult = await createAudience('Verified Therapists');
  if (createResult.error) return { data: null, error: createResult.error };
  if (!createResult.data) return { data: null, error: 'Failed to create audience' };

  THERAPIST_AUDIENCE_ID = createResult.data.id;
  return { data: createResult.data.id, error: null };
}

/**
 * Add a contact to an audience.
 */
export async function addContact(
  audienceId: string,
  email: string,
  firstName?: string,
  lastName?: string
): Promise<ApiResponse<ResendContact>> {
  return resendFetch<ResendContact>(`/audiences/${audienceId}/contacts`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      unsubscribed: false,
    }),
  });
}

/**
 * Remove a contact from an audience.
 */
export async function removeContact(
  audienceId: string,
  contactId: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  return resendFetch<{ deleted: boolean }>(`/audiences/${audienceId}/contacts/${contactId}`, {
    method: 'DELETE',
  });
}

/**
 * List contacts in an audience.
 */
export async function listContacts(audienceId: string): Promise<ApiResponse<ResendContact[]>> {
  const result = await resendFetch<{ data: ResendContact[] }>(`/audiences/${audienceId}/contacts`);
  if (result.error) return { data: null, error: result.error };
  return { data: result.data?.data || [], error: null };
}

/**
 * Sync therapists to the Resend audience.
 * Returns counts of added, skipped (already exists), and errors.
 */
export async function syncTherapistsToAudience(
  therapists: Array<{ email: string; first_name?: string; last_name?: string }>
): Promise<ApiResponse<{ added: number; skipped: number; errors: number }>> {
  const audienceResult = await getOrCreateTherapistAudience();
  if (audienceResult.error || !audienceResult.data) {
    return { data: null, error: audienceResult.error || 'Failed to get audience' };
  }

  const audienceId = audienceResult.data;
  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const therapist of therapists) {
    const result = await addContact(
      audienceId,
      therapist.email,
      therapist.first_name,
      therapist.last_name
    );

    if (result.error) {
      // Check if it's a duplicate error (contact already exists)
      if (result.error.includes('already exists') || result.error.includes('409')) {
        skipped++;
      } else {
        errors++;
        console.error(`Failed to add ${therapist.email}:`, result.error);
      }
    } else {
      added++;
    }
  }

  return { data: { added, skipped, errors }, error: null };
}

/**
 * Create a broadcast (campaign) to send to an audience.
 * Note: This creates the broadcast but doesn't send it immediately.
 * Use the Resend dashboard to review and send, or call sendBroadcast.
 */
export async function createBroadcast(params: {
  audienceId: string;
  from: string;
  subject: string;
  html: string;
  replyTo?: string;
  name?: string; // Internal name for the broadcast
}): Promise<ApiResponse<{ id: string }>> {
  return resendFetch<{ id: string }>('/broadcasts', {
    method: 'POST',
    body: JSON.stringify({
      audience_id: params.audienceId,
      from: params.from,
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo,
      name: params.name,
    }),
  });
}

/**
 * Send a broadcast immediately.
 */
export async function sendBroadcast(broadcastId: string): Promise<ApiResponse<{ id: string }>> {
  return resendFetch<{ id: string }>(`/broadcasts/${broadcastId}/send`, {
    method: 'POST',
  });
}
