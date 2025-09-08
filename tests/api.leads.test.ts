import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable state for the supabase mock
let rateLimited = false;
let lastInsertedPayload: any = null;
let insertError: any = null;
let insertResultId = 'test-id-123';
let sentEmails: any[] = [];

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'people') {
        return {
          // Rate limit query chain
          select: (_cols?: string) => ({
            contains: (_col?: string, _val?: any) => ({
              gte: (_col?: string, _cutoff?: string) => ({
                limit: (_n?: number) =>
                  Promise.resolve({ data: rateLimited ? [{}] : [], error: null }),
              }),
            }),
          }),
          // Insert path for patient leads
          insert: (payload: any) => {
            lastInsertedPayload = payload;
            return {
              select: () => ({
                single: () =>
                  Promise.resolve(
                    insertError
                      ? { data: null, error: insertError }
                      : { data: { id: insertResultId }, error: null },
                  ),
              }),
            };
          },
        } as any;
      }
      if (table === 'therapists') {
        return {
          insert: (payload: any) => {
            lastInsertedPayload = payload;
            return {
              select: () => ({
                single: () =>
                  Promise.resolve(
                    insertError
                      ? { data: null, error: insertError }
                      : { data: { id: insertResultId }, error: null },
                  ),
              }),
            };
          },
        } as any;
      }
      if (table === 'therapist_contracts') {
        return {
          insert: (_payload: any) => Promise.resolve({ data: { id: 'contract-id' }, error: null }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;

  return { supabaseServer };
});

// Mock email client to observe sends
vi.mock('@/lib/email/client', () => {
  return {
    sendEmail: vi.fn(async (params: any) => {
      sentEmails.push(params);
    }),
  } as any;
});

function makeReq(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  rateLimited = false;
  lastInsertedPayload = null;
  insertError = null;
  insertResultId = 'test-id-123';
  // Ensure notification code is disabled
  process.env.RESEND_API_KEY = '';
  process.env.LEADS_NOTIFY_EMAIL = '';
  sentEmails = [];
});

describe('/api/leads POST', () => {
  it('400 on invalid email', async () => {
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(makeReq({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Invalid email' });
  });

  it('429 when rate limited by IP within 60s', async () => {
    rateLimited = true;
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq({ email: 'user@example.com' }, { 'x-forwarded-for': '1.2.3.4' }),
    );
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Rate limited' });
  });

  it('400 when patient consent missing', async () => {
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq({ email: 'patient@example.com', type: 'patient' }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Einwilligung zur Datenübertragung erforderlich' });
  });

  it('200 on success and filters specializations to allowed set', async () => {
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq({
        email: 'ok@example.com',
        type: 'therapist',
        specializations: ['narm', 'invalid', 'somatic-experiencing', ' Hakomi '],
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { id: 'test-id-123' }, error: null });

    // Assert payload was filtered and normalized (therapists.modalities)
    expect(lastInsertedPayload).toBeTruthy();
    const specs = lastInsertedPayload.modalities || [];
    // Order is preserved for allowed entries after normalization
    expect(specs).toEqual(['narm', 'somatic-experiencing', 'hakomi']);
  });

  it("therapist leads default to status 'pending_verification'", async () => {
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq({
        email: 'therapist@example.com',
        type: 'therapist',
      }),
    );
    expect(res.status).toBe(200);
    expect(lastInsertedPayload).toBeTruthy();
    expect(lastInsertedPayload.status).toBe('pending_verification');
  });

  it("patient leads default to status 'new'", async () => {
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq({
        email: 'patient-status@example.com',
        type: 'patient',
        consent_share_with_therapists: true,
        privacy_version: 'test-v1',
      }),
    );
    expect(res.status).toBe(200);
    expect(lastInsertedPayload).toBeTruthy();
    expect(lastInsertedPayload.status).toBe('new');
  });

  it('sends patient confirmation email on patient lead success', async () => {
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq({
        email: 'patient@example.com',
        type: 'patient',
        name: 'Max Mustermann',
        city: 'Berlin',
        issue: 'Trauma-Begleitung',
        session_preference: 'in_person',
        consent_share_with_therapists: true,
        privacy_version: 'test-privacy-v1',
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { id: 'test-id-123' }, error: null });

    // One confirmation email is sent to the patient
    expect(sentEmails.length).toBe(1);
    const email = sentEmails[0];
    expect(email.to).toBe('patient@example.com');
    expect(email.subject).toBe('Ihre Anfrage bei Kaufmann Health erhalten');
    expect(email.html).toBeTruthy();
    expect(email.html).toContain('Ihre Angaben');
    expect(email.html).toContain('Berlin');
    expect(email.html).toContain('Trauma-Begleitung');
    expect(email.html).toContain('Vor Ort');

    // Consent metadata stored correctly (top-level)
    expect(lastInsertedPayload).toBeTruthy();
    const meta = lastInsertedPayload.metadata || {};
    expect(meta.consent_share_with_therapists).toBe(true);
    expect(typeof meta.consent_share_with_therapists_at).toBe('string');
    expect(Number.isNaN(Date.parse(meta.consent_share_with_therapists_at))).toBe(false);
    expect(meta.consent_privacy_version).toBe('test-privacy-v1');
  });

  it('handles missing optional fields gracefully and still sends confirmation', async () => {
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq({
        email: 'patient2@example.com',
        type: 'patient',
        consent_share_with_therapists: true,
        privacy_version: 'v-test',
        // no city / issue / session_preference
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { id: 'test-id-123' }, error: null });

    expect(sentEmails.length).toBe(1);
    const email = sentEmails[0];
    expect(email.to).toBe('patient2@example.com');
    expect(email.subject).toBe('Ihre Anfrage bei Kaufmann Health erhalten');
    expect(email.html).toBeTruthy();
    expect(email.html).toContain('Ihre Angaben');
    expect(email.html).toContain('Sitzungsart');
  });

  it("email send failure doesn't break patient submission (fire-and-forget)", async () => {
    const emailClient: any = await import('@/lib/email/client');
    // Make the next call reject but still record the attempt
    emailClient.sendEmail.mockImplementationOnce(async (params: any) => {
      sentEmails.push(params);
      throw new Error('send failed');
    });

    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq({
        email: 'patient3@example.com',
        type: 'patient',
        consent_share_with_therapists: true,
        privacy_version: 'p-v1',
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { id: 'test-id-123' }, error: null });
  });

  it('stores consent metadata for patient leads', async () => {
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq(
        {
          email: 'withconsent@example.com',
          type: 'patient',
          consent_share_with_therapists: true,
          privacy_version: '1.0',
        },
        { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UnitTestAgent' },
      ),
    );
    expect(res.status).toBe(200);
    expect(lastInsertedPayload).toBeTruthy();
    const meta = lastInsertedPayload.metadata || {};
    expect(meta.consent_share_with_therapists).toBe(true);
    expect(typeof meta.consent_share_with_therapists_at).toBe('string');
    expect(Number.isNaN(Date.parse(meta.consent_share_with_therapists_at))).toBe(false);
    expect(meta.consent_privacy_version).toBe('1.0');
    // Basic context fields still present at top-level
    expect(meta.user_agent).toBe('UnitTestAgent');
  });
});
