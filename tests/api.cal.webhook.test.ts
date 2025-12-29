/**
 * Tests for Cal.com webhook ingestion endpoint
 * POST /api/public/cal/webhook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// Mock Supabase with proper chaining
const mockMaybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockEq = vi.fn(() => ({
  maybeSingle: mockMaybeSingle,
  order: mockOrder,
  eq: vi.fn(() => ({ order: mockOrder, maybeSingle: mockMaybeSingle })),
}));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpsert = vi.fn(() => Promise.resolve({ data: null, error: null }));

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
    })),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  track: vi.fn(),
}));

const TEST_WEBHOOK_SECRET = 'test-secret-key-12345';

function generateSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function createBookingPayload(overrides: Record<string, unknown> = {}) {
  return {
    triggerEvent: 'BOOKING_CREATED',
    createdAt: new Date().toISOString(),
    payload: {
      uid: 'test-booking-uid-123',
      eventTypeId: 1,
      startTime: '2025-01-15T10:00:00.000Z',
      endTime: '2025-01-15T10:30:00.000Z',
      organizer: {
        id: 1,
        username: 'test-therapist',
        name: 'Test Therapist',
        email: 'therapist@example.com',
      },
      attendees: [
        {
          email: 'patient@example.com',
          name: 'Test Patient',
        },
      ],
      metadata: {
        kh_booking_kind: 'intro',
        kh_source: 'directory',
        kh_test: false,
      },
      status: 'ACCEPTED',
      ...overrides,
    },
  };
}

describe('Cal.com Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CAL_WEBHOOK_SECRET', TEST_WEBHOOK_SECRET);
  });

  it('rejects requests without signature', async () => {
    const { POST } = await import('@/app/api/public/cal/webhook/route');

    const body = JSON.stringify(createBookingPayload());
    const req = new Request('http://localhost/api/public/cal/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Invalid signature');
  });

  it('rejects requests with invalid signature', async () => {
    const { POST } = await import('@/app/api/public/cal/webhook/route');

    const body = JSON.stringify(createBookingPayload());
    const req = new Request('http://localhost/api/public/cal/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cal-signature-256': 'invalid-signature',
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('accepts requests with valid signature and processes BOOKING_CREATED', async () => {
    const { POST } = await import('@/app/api/public/cal/webhook/route');

    const payload = createBookingPayload();
    const body = JSON.stringify(payload);
    const signature = generateSignature(body, TEST_WEBHOOK_SECRET);

    const req = new Request('http://localhost/api/public/cal/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cal-signature-256': signature,
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('handles BOOKING_RESCHEDULED event', async () => {
    const { POST } = await import('@/app/api/public/cal/webhook/route');

    const payload = {
      ...createBookingPayload(),
      triggerEvent: 'BOOKING_RESCHEDULED',
    };
    const body = JSON.stringify(payload);
    const signature = generateSignature(body, TEST_WEBHOOK_SECRET);

    const req = new Request('http://localhost/api/public/cal/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cal-signature-256': signature,
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('handles BOOKING_CANCELLED event', async () => {
    const { POST } = await import('@/app/api/public/cal/webhook/route');

    const payload = {
      ...createBookingPayload(),
      triggerEvent: 'BOOKING_CANCELLED',
    };
    const body = JSON.stringify(payload);
    const signature = generateSignature(body, TEST_WEBHOOK_SECRET);

    const req = new Request('http://localhost/api/public/cal/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cal-signature-256': signature,
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('rejects invalid JSON', async () => {
    const { POST } = await import('@/app/api/public/cal/webhook/route');

    const body = 'not-valid-json';
    const signature = generateSignature(body, TEST_WEBHOOK_SECRET);

    const req = new Request('http://localhost/api/public/cal/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cal-signature-256': signature,
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid JSON');
  });

  it('rejects payload missing required fields', async () => {
    const { POST } = await import('@/app/api/public/cal/webhook/route');

    const payload = { triggerEvent: 'BOOKING_CREATED' }; // missing payload.uid
    const body = JSON.stringify(payload);
    const signature = generateSignature(body, TEST_WEBHOOK_SECRET);

    const req = new Request('http://localhost/api/public/cal/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cal-signature-256': signature,
      },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
  });
});
