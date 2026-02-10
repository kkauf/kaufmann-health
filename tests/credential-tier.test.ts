/**
 * Credential Tier Tests
 *
 * Tests the two-tier credential system:
 * - Handler: qualification → credential_tier derivation
 * - Contracts: schema validation for credential_tier
 * - Mapper: credential_tier flows through to public API output
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────

let lastInsertedPayload: any = null;
let insertError: any = null;
const insertResultId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'therapists') {
        return {
          select: () => ({
            like: () => Promise.resolve({ data: [], error: null }),
          }),
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
          insert: () => Promise.resolve({ data: { id: 'contract-id' }, error: null }),
        } as any;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as any;
  return { supabaseServer };
});

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
  sendTherapistEmail: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock('@/lib/server-analytics', () => ({
  ServerAnalytics: { trackEventFromRequest: vi.fn() },
  parseAttributionFromRequest: vi.fn(() => ({})),
  parseCampaignFromRequest: vi.fn(() => ({})),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/lib/test-mode', () => ({
  isTestRequest: () => true,
}));

// ─── Tests ──────────────────────────────────────────────

beforeEach(() => {
  lastInsertedPayload = null;
  insertError = null;
  process.env.RESEND_API_KEY = '';
});

describe('Credential Tier: Handler', () => {
  it('derives credential_tier=certified for Psychologische:r Berater:in', async () => {
    const { handleTherapistLead } = await import('@/features/leads/lib/handlers');
    const req = new Request('http://localhost/test', { method: 'POST' });
    const ctx = { req, ip: '127.0.0.1', ua: 'test-agent' };

    await handleTherapistLead(ctx, {
      data: { email: 'coach@example.com', name: 'Test Coach' },
      sessionPreferences: ['online'],
      specializations: ['narm'],
      qualification: 'Psychologische:r Berater:in',
    });

    expect(lastInsertedPayload).toBeTruthy();
    expect(lastInsertedPayload.credential_tier).toBe('certified');
  });

  it('derives credential_tier=licensed for HP qualification', async () => {
    const { handleTherapistLead } = await import('@/features/leads/lib/handlers');
    const req = new Request('http://localhost/test', { method: 'POST' });
    const ctx = { req, ip: '127.0.0.1', ua: 'test-agent' };

    await handleTherapistLead(ctx, {
      data: { email: 'hp@example.com', name: 'Test HP' },
      sessionPreferences: ['in_person'],
      specializations: ['hakomi'],
      qualification: 'Heilpraktiker für Psychotherapie',
    });

    expect(lastInsertedPayload).toBeTruthy();
    expect(lastInsertedPayload.credential_tier).toBe('licensed');
  });

  it('derives credential_tier=licensed for Approbierte:r', async () => {
    const { handleTherapistLead } = await import('@/features/leads/lib/handlers');
    const req = new Request('http://localhost/test', { method: 'POST' });
    const ctx = { req, ip: '127.0.0.1', ua: 'test-agent' };

    await handleTherapistLead(ctx, {
      data: { email: 'appro@example.com', name: 'Test Appro' },
      sessionPreferences: ['online'],
      specializations: ['somatic-experiencing'],
      qualification: 'Approbierte:r Psychotherapeut:in',
    });

    expect(lastInsertedPayload).toBeTruthy();
    expect(lastInsertedPayload.credential_tier).toBe('licensed');
  });

  it('derives credential_tier=licensed for Heilpraktiker:in', async () => {
    const { handleTherapistLead } = await import('@/features/leads/lib/handlers');
    const req = new Request('http://localhost/test', { method: 'POST' });
    const ctx = { req, ip: '127.0.0.1', ua: 'test-agent' };

    await handleTherapistLead(ctx, {
      data: { email: 'hpk@example.com', name: 'Test HPK' },
      sessionPreferences: ['online', 'in_person'],
      specializations: ['narm'],
      qualification: 'Heilpraktiker:in',
    });

    expect(lastInsertedPayload).toBeTruthy();
    expect(lastInsertedPayload.credential_tier).toBe('licensed');
  });

  it('defaults credential_tier to licensed when qualification is missing', async () => {
    const { handleTherapistLead } = await import('@/features/leads/lib/handlers');
    const req = new Request('http://localhost/test', { method: 'POST' });
    const ctx = { req, ip: '127.0.0.1', ua: 'test-agent' };

    await handleTherapistLead(ctx, {
      data: { email: 'noqualif@example.com', name: 'Test No Qualif' },
      sessionPreferences: ['online'],
      specializations: ['narm'],
      // no qualification
    });

    expect(lastInsertedPayload).toBeTruthy();
    expect(lastInsertedPayload.credential_tier).toBe('licensed');
  });

  it('stores qualification in metadata.profile', async () => {
    const { handleTherapistLead } = await import('@/features/leads/lib/handlers');
    const req = new Request('http://localhost/test', { method: 'POST' });
    const ctx = { req, ip: '127.0.0.1', ua: 'test-agent' };

    await handleTherapistLead(ctx, {
      data: { email: 'metacheck@example.com', name: 'Test Meta' },
      sessionPreferences: ['online'],
      specializations: ['narm'],
      qualification: 'Psychologische:r Berater:in',
    });

    expect(lastInsertedPayload).toBeTruthy();
    expect(lastInsertedPayload.metadata?.profile?.qualification).toBe('Psychologische:r Berater:in');
  });
});

describe('Credential Tier: Contracts', () => {
  it('TherapistRowSchema accepts both tier values', async () => {
    const { TherapistRowSchema } = await import('@/contracts/therapist');

    const baseRow = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      photo_url: '',
      status: 'verified',
      city: 'Berlin',
      modalities: ['narm'],
      schwerpunkte: [],
      session_preferences: ['online'],
      accepting_new: true,
    };

    const licensed = TherapistRowSchema.parse({ ...baseRow, credential_tier: 'licensed' });
    expect(licensed.credential_tier).toBe('licensed');

    const certified = TherapistRowSchema.parse({ ...baseRow, credential_tier: 'certified' });
    expect(certified.credential_tier).toBe('certified');
  });

  it('TherapistRowSchema defaults to licensed when tier is absent', async () => {
    const { TherapistRowSchema } = await import('@/contracts/therapist');

    const row = TherapistRowSchema.parse({
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      photo_url: '',
      status: 'verified',
      city: 'Berlin',
      modalities: ['narm'],
      schwerpunkte: [],
      session_preferences: ['online'],
      accepting_new: true,
    });

    expect(row.credential_tier).toBe('licensed');
  });

  it('TherapistRowSchema rejects invalid tier value', async () => {
    const { TherapistRowSchema } = await import('@/contracts/therapist');

    expect(() =>
      TherapistRowSchema.parse({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        photo_url: '',
        status: 'verified',
        credential_tier: 'invalid_tier',
      }),
    ).toThrow();
  });

  it('THERAPIST_SELECT_COLUMNS includes credential_tier', async () => {
    const { THERAPIST_SELECT_COLUMNS } = await import('@/contracts/therapist');
    expect(THERAPIST_SELECT_COLUMNS).toContain('credential_tier');
  });
});

describe('Credential Tier: Mapper', () => {
  it('mapTherapistRow passes through credential_tier', async () => {
    const { mapTherapistRow, parseTherapistRows } = await import('@/lib/therapist-mapper');

    const rawRow = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      first_name: 'Test',
      last_name: 'Coach',
      email: 'coach@example.com',
      photo_url: '',
      status: 'verified',
      city: 'Berlin',
      modalities: ['narm'],
      schwerpunkte: ['trauma'],
      session_preferences: ['online'],
      accepting_new: true,
      credential_tier: 'certified',
      metadata: {},
    };

    const [parsed] = parseTherapistRows([rawRow]);
    const mapped = mapTherapistRow(parsed);

    expect(mapped.credential_tier).toBe('certified');
  });

  it('mapTherapistRow defaults credential_tier to licensed', async () => {
    const { mapTherapistRow, parseTherapistRows } = await import('@/lib/therapist-mapper');

    const rawRow = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      first_name: 'Test',
      last_name: 'HP',
      email: 'hp@example.com',
      photo_url: '',
      status: 'verified',
      city: 'Berlin',
      modalities: ['hakomi'],
      schwerpunkte: [],
      session_preferences: ['in_person'],
      accepting_new: true,
      // no credential_tier → should default
      metadata: {},
    };

    const [parsed] = parseTherapistRows([rawRow]);
    const mapped = mapTherapistRow(parsed);

    expect(mapped.credential_tier).toBe('licensed');
  });
});
