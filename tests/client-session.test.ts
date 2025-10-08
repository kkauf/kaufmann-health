/**
 * Tests for client session utilities (EARTH-203)
 */

import { describe, it, expect } from 'vitest';
import {
  createClientSessionToken,
  verifyClientSessionToken,
  createClientSessionCookie,
  clearClientSessionCookie,
} from '@/lib/auth/clientSession';

describe('Client Session', () => {
  it('creates and verifies a valid session token', async () => {
    const payload = {
      patient_id: 'patient-123',
      contact_method: 'email' as const,
      contact_value: 'test@example.com',
      name: 'Test User',
    };

    const token = await createClientSessionToken(payload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const verified = await verifyClientSessionToken(token);
    expect(verified).toBeTruthy();
    expect(verified?.patient_id).toBe(payload.patient_id);
    expect(verified?.contact_method).toBe(payload.contact_method);
    expect(verified?.contact_value).toBe(payload.contact_value);
    expect(verified?.name).toBe(payload.name);
  });

  it('rejects invalid tokens', async () => {
    const verified = await verifyClientSessionToken('invalid-token');
    expect(verified).toBeNull();
  });

  it('creates a properly formatted cookie', () => {
    const token = 'test-token-123';
    const cookie = createClientSessionCookie(token);

    expect(cookie).toContain('kh_client=test-token-123');
    expect(cookie).toContain('Max-Age=2592000'); // 30 days
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('creates a clear cookie header', () => {
    const cookie = clearClientSessionCookie();

    expect(cookie).toContain('kh_client=');
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Path=/');
  });

  it('supports phone contact method', async () => {
    const payload = {
      patient_id: 'patient-456',
      contact_method: 'phone' as const,
      contact_value: '+491234567890',
      name: 'Phone User',
    };

    const token = await createClientSessionToken(payload);
    const verified = await verifyClientSessionToken(token);

    expect(verified?.contact_method).toBe('phone');
    expect(verified?.contact_value).toBe('+491234567890');
  });
});
