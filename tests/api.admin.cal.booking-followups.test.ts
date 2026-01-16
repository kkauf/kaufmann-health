/**
 * Tests for Cal.com booking reminder cron endpoint
 * GET /api/admin/cal/booking-followups
 * 
 * Critical for:
 * - 24h booking reminders
 * - 1h booking reminders
 * - Test mode filtering
 * - Idempotency via sent_at columns
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock data
const mockBooking = {
  id: 'booking-1',
  cal_uid: 'cal-uid-1',
  therapist_id: 'therapist-1',
  patient_id: 'patient-1',
  match_id: 'match-1',
  start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  end_time: new Date(Date.now() + 24.5 * 60 * 60 * 1000).toISOString(),
  booking_kind: 'intro',
  is_test: false,
  followup_sent_at: null,
  reminder_24h_sent_at: null,
  reminder_1h_sent_at: null,
  metadata: {},
};

const mockPatient = {
  id: 'patient-1',
  email: 'patient@example.com',
  phone: '+491511234567',
  first_name: 'Max',
};

const mockTherapist = {
  id: 'therapist-1',
  first_name: 'Sandra',
  last_name: 'Therapist',
  cal_username: 'sandra-therapist',
};

// Mock Supabase
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
const mockSingle = vi.fn();
const mockLimit = vi.fn();
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockNot = vi.fn(() => ({ order: mockOrder }));
const mockIs = vi.fn(() => ({ not: mockNot }));
const mockLte = vi.fn(() => ({ is: mockIs }));
const mockGte = vi.fn(() => ({ lte: mockLte }));
const mockSelect = vi.fn(() => ({ 
  gte: mockGte,
  eq: vi.fn(() => ({ single: mockSingle })),
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn((table: string) => {
      if (table === 'cal_bookings') {
        return { select: mockSelect, update: mockUpdate };
      }
      if (table === 'people') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) })) };
      }
      if (table === 'therapists') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) })) };
      }
      return { select: mockSelect };
    }),
  },
}));

// Mock email client
const mockSendEmail = vi.fn(() => Promise.resolve({ sent: true }));
vi.mock('@/lib/email/client', () => ({
  sendEmail: () => mockSendEmail(),
}));

// Mock SMS client
const mockSendSms = vi.fn(() => Promise.resolve(true));
vi.mock('@/lib/sms/client', () => ({
  sendTransactionalSms: () => mockSendSms(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  track: vi.fn(),
}));

// Mock email template
vi.mock('@/lib/email/templates/calBookingReminder', () => ({
  renderCalBookingReminder: vi.fn(() => ({
    subject: 'Erinnerung: Termin morgen',
    html: '<p>Reminder email</p>',
  })),
}));

const CRON_SECRET = 'test-cron-secret';

describe('Cal.com Booking Followups Cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    
    // Default mock returns
    mockLimit.mockReturnValue(Promise.resolve({ data: [], error: null }));
    mockSingle.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  it('rejects requests without auth', async () => {
    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest('http://localhost/api/admin/cal/booking-followups');
    const res = await GET(req);
    
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('accepts Bearer token auth', async () => {
    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest('http://localhost/api/admin/cal/booking-followups', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    
    expect(res.status).toBe(200);
  });

  it('accepts query param token auth', async () => {
    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest(`http://localhost/api/admin/cal/booking-followups?token=${CRON_SECRET}`);
    const res = await GET(req);
    
    expect(res.status).toBe(200);
  });

  it('processes all stages when no stage specified', async () => {
    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest('http://localhost/api/admin/cal/booking-followups', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stages).toEqual(['reminder_24h', 'reminder_1h']);
  });

  it('processes only specified stage', async () => {
    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest('http://localhost/api/admin/cal/booking-followups?stage=reminder_24h', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stages).toEqual(['reminder_24h']);
  });

  it('returns aggregated totals', async () => {
    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest('http://localhost/api/admin/cal/booking-followups', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totals).toHaveProperty('processed');
    expect(json.totals).toHaveProperty('sent_email');
    expect(json.totals).toHaveProperty('sent_sms');
    expect(json.totals).toHaveProperty('skipped_test');
    expect(json.totals).toHaveProperty('errors');
  });

  it('respects limit parameter', async () => {
    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest('http://localhost/api/admin/cal/booking-followups?limit=10', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    await GET(req);
    
    // Verify limit was passed to query
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('caps limit at 200', async () => {
    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest('http://localhost/api/admin/cal/booking-followups?limit=500', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    await GET(req);
    
    // Should be capped at 200
    expect(mockLimit).toHaveBeenCalledWith(200);
  });
});

describe('Booking Reminder Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
  });

  it('skips test bookings', async () => {
    // Setup mock to return a test booking
    mockLimit.mockReturnValue(Promise.resolve({ 
      data: [{ ...mockBooking, is_test: true }], 
      error: null 
    }));
    mockSingle.mockReturnValue(Promise.resolve({ data: mockPatient, error: null }));

    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest('http://localhost/api/admin/cal/booking-followups?stage=reminder_24h', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    
    const json = await res.json();
    expect(json.results[0].counters.skipped_test).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('skips bookings without patient', async () => {
    mockLimit.mockReturnValue(Promise.resolve({ 
      data: [mockBooking], 
      error: null 
    }));
    // Return null patient
    mockSingle.mockReturnValue(Promise.resolve({ data: null, error: null }));

    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest('http://localhost/api/admin/cal/booking-followups?stage=reminder_24h', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    
    const json = await res.json();
    expect(json.results[0].counters.skipped_no_patient).toBe(1);
  });

  it('skips patients without contact info', async () => {
    mockLimit.mockReturnValue(Promise.resolve({ 
      data: [mockBooking], 
      error: null 
    }));
    // Return patient without email or phone
    mockSingle.mockReturnValue(Promise.resolve({ 
      data: { ...mockPatient, email: null, phone: null }, 
      error: null 
    }));

    const { GET } = await import('@/app/api/admin/cal/booking-followups/route');
    
    const req = new NextRequest('http://localhost/api/admin/cal/booking-followups?stage=reminder_24h', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    
    const json = await res.json();
    expect(json.results[0].counters.skipped_no_contact).toBe(1);
  });
});
