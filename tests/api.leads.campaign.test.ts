import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture DB inserts and track calls
let lastInsertPayload: any = null;
const sentEmails: any[] = [];
const trackedEvents: any[] = [];

// Mock email client to avoid real sends
vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(async (params: any) => { sentEmails.push(params); }),
}));

// Mock logger.track to capture events
vi.mock('@/lib/logger', async () => {
  const mod: any = await vi.importActual('@/lib/logger');
  return {
    ...mod,
    track: vi.fn(async (event: any) => {
      trackedEvents.push(event);
    })
  };
});

// Mock supabase for people table
vi.mock('@/lib/supabase-server', () => {
  const api: any = {
    from: (table: string) => {
      if (table !== 'people') throw new Error(`unexpected table: ${table}`);
      return {
        insert: (payload: any) => {
          lastInsertPayload = payload;
          return {
            select: () => ({
              single: async () => ({ data: { id: 'mock-people-1' }, error: null })
            })
          };
        },
        select: () => ({
          eq: () => ({ single: async () => ({ data: { id: 'mock-people-1' }, error: null }) })
        }),
        update: () => ({ eq: () => ({ data: null, error: null }) })
      };
    },
  };
  return { supabaseServer: api };
});

function makeReqEmailOnly(body: any, referer: string, apiUrl: string) {
  return new Request(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', referer },
    body: JSON.stringify(body),
  });
}

function makeReqLegacy(body: any, referer: string) {
  return new Request('http://localhost/api/leads?v=A', {
    method: 'POST',
    headers: { 'content-type': 'application/json', referer },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost';
  process.env.REQUIRE_EMAIL_CONFIRMATION = 'true';
  lastInsertPayload = null;
  sentEmails.length = 0;
  trackedEvents.length = 0;
  vi.clearAllMocks();
});

describe('Campaign attribution', () => {
  it('email-only: prefers variant from referer, landing_page is pathname, persists campaign_* and tracks event', async () => {
    const { POST } = await import('@/app/api/leads/route');
    const referer = 'http://localhost/wieder-lebendig?v=B&utm_source=x';
    const apiUrl = 'http://localhost/api/leads?v=A';
    const res = await POST(makeReqEmailOnly({ email: 'user@example.com', type: 'patient' }, referer, apiUrl));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.requiresConfirmation).toBe(true);

    // DB insert should include campaign_* fields
    expect(lastInsertPayload).toBeTruthy();
    expect(lastInsertPayload.campaign_source).toBe('/wieder-lebendig');
    expect(lastInsertPayload.campaign_variant).toBe('B');
    expect(lastInsertPayload.landing_page).toBe('/wieder-lebendig');

    // Event should include campaign props
    const ev = trackedEvents.find(e => e?.type === 'email_submitted');
    expect(ev).toBeTruthy();
    expect(ev.props.campaign_source).toBe('/wieder-lebendig');
    expect(ev.props.campaign_variant).toBe('B');
    expect(ev.props.landing_page).toBe('/wieder-lebendig');
  });

  it('legacy patient: persists campaign_* from referer and fallback variant from API URL', async () => {
    process.env.REQUIRE_EMAIL_CONFIRMATION = 'false';
    const { POST } = await import('@/app/api/leads/route');
    const referer = 'http://localhost/ankommen-in-dir'; // no v param
    const res = await POST(makeReqLegacy({ email: 'user@example.com', type: 'patient', consent_share_with_therapists: true }, referer));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();

    expect(lastInsertPayload).toBeTruthy();
    expect(lastInsertPayload.campaign_source).toBe('/ankommen-in-dir');
    expect(lastInsertPayload.campaign_variant).toBe('A'); // from API URL
    expect(lastInsertPayload.landing_page).toBe('/ankommen-in-dir');

    const ev = trackedEvents.find(e => e?.type === 'lead_submitted' && e?.props?.lead_type === 'patient');
    expect(ev).toBeTruthy();
    expect(ev.props.campaign_source).toBe('/ankommen-in-dir');
    expect(ev.props.campaign_variant).toBe('A');
    expect(ev.props.landing_page).toBe('/ankommen-in-dir');
  });
});
