import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture DB inserts and track calls
let lastInsertPayload: any = null;
const sentEmails: any[] = [];
const trackedEvents: any[] = [];

// Mock email client to avoid real sends
vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(async (params: any) => { sentEmails.push(params); return { sent: true }; }),
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

function makeReq(body: any, referer: string, apiUrl: string) {
  return new Request(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', referer },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost';
  lastInsertPayload = null;
  sentEmails.length = 0;
  trackedEvents.length = 0;
  vi.clearAllMocks();
});
describe('Campaign attribution', () => {
  it('email-only: prefers variant from referer, persists campaign_* and tracks event', async () => {
    const { POST } = await import("@/app/api/public/leads/route");
    const referer = 'http://localhost/wieder-lebendig?v=B&utm_source=x';
    const apiUrl = 'http://localhost/api/public/leads?v=A';
    const res: any = await POST(
      makeReq(
        {
          email: 'user@example.com',
          type: 'patient',
          consent_share_with_therapists: true,
          privacy_version: '2025-09-01.v2',
        },
        referer,
        apiUrl
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.requiresConfirmation).toBe(true);
    expect(lastInsertPayload).toBeTruthy();
    expect(lastInsertPayload.campaign_source).toBe('/wieder-lebendig');
    expect(lastInsertPayload.campaign_variant).toBe('b');
    // landing_page no longer persisted

    // Event should include campaign props
    const ev = trackedEvents.find(e => e?.type === 'email_submitted');
    expect(ev).toBeTruthy();
    expect(ev.props.campaign_source).toBe('/wieder-lebendig');
    expect(ev.props.campaign_variant).toBe('b');
    // landing_page no longer included in events
  });

  it('server-side: /lp/narm referrer produces campaign_source=/lp/narm', async () => {
    const { POST } = await import("@/app/api/public/leads/route");
    const referer = 'http://localhost/lp/narm?v=online';
    const apiUrl = 'http://localhost/api/public/leads';
    const res: any = await POST(
      makeReq(
        {
          email: 'lp-narm@example.com',
          type: 'patient',
          consent_share_with_therapists: true,
          privacy_version: '2025-09-01.v2',
        },
        referer,
        apiUrl
      )
    );
    expect(res.status).toBe(200);
    expect(lastInsertPayload).toBeTruthy();
    expect(lastInsertPayload.campaign_source).toBe('/lp/narm');
    expect(lastInsertPayload.campaign_variant).toBe('online');
  });

  it('client-side override: online mode sets campaign_variant=online', async () => {
    const { POST } = await import("@/app/api/public/leads/route");
    const referer = 'http://localhost/start';
    const apiUrl = 'http://localhost/api/public/leads';
    // Simulate SignupWizard sending override headers for online mode
    const req = new Request(apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer,
        'x-campaign-source-override': '/start',
        'x-campaign-variant-override': 'online',
      },
      body: JSON.stringify({
        email: 'online@example.com',
        type: 'patient',
        consent_share_with_therapists: true,
        privacy_version: '2025-09-01.v2',
      }),
    });
    const res: any = await POST(req);
    expect(res.status).toBe(200);
    expect(lastInsertPayload).toBeTruthy();
    expect(lastInsertPayload.campaign_variant).toBe('online');
    expect(lastInsertPayload.campaign_source).toBe('/start');
  });

  // Legacy path removed; email-first is the only patient path
});

describe('parseCampaignFromRequest — /lp/ paths', () => {
  it('/lp/narm referrer → campaign_source=/lp/narm', async () => {
    const { parseCampaignFromRequest } = await import('@/lib/server-analytics');
    const req = new Request('http://localhost/api/public/leads', {
      headers: { referer: 'http://localhost/lp/narm?modality=narm' },
    });
    const result = parseCampaignFromRequest(req);
    expect(result.campaign_source).toBe('/lp/narm');
  });

  it('/lp/hakomi referrer → campaign_source=/lp/hakomi', async () => {
    const { parseCampaignFromRequest } = await import('@/lib/server-analytics');
    const req = new Request('http://localhost/api/public/leads', {
      headers: { referer: 'http://localhost/lp/hakomi' },
    });
    const result = parseCampaignFromRequest(req);
    expect(result.campaign_source).toBe('/lp/hakomi');
  });

  it('/lp/narm with variant → captures variant', async () => {
    const { parseCampaignFromRequest } = await import('@/lib/server-analytics');
    const req = new Request('http://localhost/api/public/leads', {
      headers: { referer: 'http://localhost/lp/narm?v=online' },
    });
    const result = parseCampaignFromRequest(req);
    expect(result.campaign_source).toBe('/lp/narm');
    expect(result.campaign_variant).toBe('online');
  });
});
