import { describe, it, expect } from 'vitest';

import { buildInternalLeadNotification } from '@/lib/email/internalNotification';

describe('internal notification (PII-free)', () => {
  it('formats therapist subject/body in English incl. city and contract line', () => {
    const notif = buildInternalLeadNotification({
      id: 'abc-123',
      metadata: { lead_type: 'therapist', city: 'Berlin' },
    });
    expect(notif.subject).toBe('Lead: therapist · Berlin');
    expect(notif.text).toContain('Lead received (therapist · Berlin)');
    expect(notif.text).toContain('Lead ID: abc-123');
    expect(notif.text).toContain('Contract signed automatically');
    // No PII fields
    expect(notif.text).not.toContain('Name:');
    expect(notif.text).not.toContain('Email:');
    expect(notif.text).not.toContain('Phone:');
  });

  it('formats patient subject/body in English and omits PII', () => {
    const notif = buildInternalLeadNotification({
      id: 'xyz-789',
      metadata: { lead_type: 'patient', city: 'Berlin' },
    });
    expect(notif.subject).toBe('Lead: patient · Berlin');
    expect(notif.text).toContain('Lead received (patient · Berlin)');
    expect(notif.text).toContain('Lead ID: xyz-789');
    expect(notif.text).toContain('PII is available only in Supabase.');
    expect(notif.text).not.toContain('Contract signed automatically');
  });

  it('falls back to unknown city', () => {
    const notif = buildInternalLeadNotification({ id: 'id-1', metadata: { lead_type: 'therapist', city: '' } });
    expect(notif.subject).toBe('Lead: therapist · unknown');
    expect(notif.text).toContain('Lead received (therapist · unknown)');
  });
});
