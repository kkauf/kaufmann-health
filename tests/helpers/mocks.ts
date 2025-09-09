import { vi } from 'vitest';

// Tracking arrays for optional test assertions
export const mockEmails: any[] = [];
export const mockEvents: any[] = [];

// Reset function for beforeEach in suites that opt-in to these helpers
export function resetMocks() {
  mockEmails.length = 0;
  mockEvents.length = 0;
  vi.clearAllMocks();
}

// Optional setup to capture analytics/email calls in tests
export function setupMockTracking() {
  try {
    const email = require('@/lib/email/client');
    if (email?.sendEmail && typeof email.sendEmail === 'function') {
      vi.spyOn(email, 'sendEmail').mockImplementation(async (params: any) => {
        mockEmails.push(params);
      });
    }
  } catch {}

  try {
    const logger = require('@/lib/logger');
    if (logger?.track && typeof logger.track === 'function') {
      vi.spyOn(logger, 'track').mockImplementation(async (event: any) => {
        mockEvents.push(event);
      });
    }
  } catch {}
}
