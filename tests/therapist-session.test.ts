import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTherapistSessionToken,
  verifyTherapistSessionToken,
  createTherapistSessionCookie,
  clearTherapistSessionCookie,
  getTherapistSession,
  getTherapistSessionCookieName,
} from '@/lib/auth/therapistSession';

// Mock JWT_SECRET for tests
vi.stubEnv('JWT_SECRET', 'test-secret-key-for-therapist-session');

describe('therapistSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTherapistSessionToken', () => {
    it('creates a valid JWT token', async () => {
      const token = await createTherapistSessionToken({
        therapist_id: 'test-therapist-id',
        email: 'therapist@example.com',
        name: 'Test Therapist',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('creates token without optional name field', async () => {
      const token = await createTherapistSessionToken({
        therapist_id: 'test-therapist-id',
        email: 'therapist@example.com',
      });

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyTherapistSessionToken', () => {
    it('verifies a valid token and returns payload', async () => {
      const token = await createTherapistSessionToken({
        therapist_id: 'test-therapist-id',
        email: 'therapist@example.com',
        name: 'Test Therapist',
      });

      const payload = await verifyTherapistSessionToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.therapist_id).toBe('test-therapist-id');
      expect(payload?.email).toBe('therapist@example.com');
      expect(payload?.name).toBe('Test Therapist');
      expect(payload?.iat).toBeDefined();
      expect(payload?.exp).toBeDefined();
    });

    it('returns null for invalid token', async () => {
      const payload = await verifyTherapistSessionToken('invalid.token.here');
      expect(payload).toBeNull();
    });

    it('returns null for empty token', async () => {
      const payload = await verifyTherapistSessionToken('');
      expect(payload).toBeNull();
    });

    it('returns null for tampered token', async () => {
      const token = await createTherapistSessionToken({
        therapist_id: 'test-therapist-id',
        email: 'therapist@example.com',
      });

      // Tamper with the token
      const parts = token.split('.');
      parts[1] = 'tamperedPayload';
      const tamperedToken = parts.join('.');

      const payload = await verifyTherapistSessionToken(tamperedToken);
      expect(payload).toBeNull();
    });
  });

  describe('createTherapistSessionCookie', () => {
    it('creates cookie string with correct attributes', () => {
      const token = 'test-token';
      const cookie = createTherapistSessionCookie(token);

      expect(cookie).toContain('kh_therapist=test-token');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=');
    });

    it('includes Secure flag in production', () => {
      const originalEnv = process.env.NODE_ENV;
      vi.stubEnv('NODE_ENV', 'production');

      const cookie = createTherapistSessionCookie('test-token');
      expect(cookie).toContain('Secure');

      vi.stubEnv('NODE_ENV', originalEnv || 'test');
    });
  });

  describe('clearTherapistSessionCookie', () => {
    it('creates cookie string that clears the session', () => {
      const cookie = clearTherapistSessionCookie();

      expect(cookie).toContain('kh_therapist=');
      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('Path=/');
    });
  });

  describe('getTherapistSession', () => {
    it('extracts and verifies session from request cookies', async () => {
      const token = await createTherapistSessionToken({
        therapist_id: 'test-therapist-id',
        email: 'therapist@example.com',
      });

      const mockRequest = new Request('https://example.com', {
        headers: {
          cookie: `kh_therapist=${token}; other_cookie=value`,
        },
      });

      const session = await getTherapistSession(mockRequest);

      expect(session).not.toBeNull();
      expect(session?.therapist_id).toBe('test-therapist-id');
      expect(session?.email).toBe('therapist@example.com');
    });

    it('returns null when no cookie header', async () => {
      const mockRequest = new Request('https://example.com');
      const session = await getTherapistSession(mockRequest);
      expect(session).toBeNull();
    });

    it('returns null when session cookie not present', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: {
          cookie: 'other_cookie=value',
        },
      });

      const session = await getTherapistSession(mockRequest);
      expect(session).toBeNull();
    });

    it('returns null for invalid token in cookie', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: {
          cookie: 'kh_therapist=invalid-token',
        },
      });

      const session = await getTherapistSession(mockRequest);
      expect(session).toBeNull();
    });
  });

  describe('getTherapistSessionCookieName', () => {
    it('returns the correct cookie name', () => {
      expect(getTherapistSessionCookieName()).toBe('kh_therapist');
    });
  });
});
