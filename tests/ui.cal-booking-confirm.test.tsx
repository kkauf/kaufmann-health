/**
 * @vitest-environment jsdom
 *
 * Tests for CalBookingConfirm component — post-booking contact collection
 *
 * Verifies:
 * - Phone-only users see email collection prompt (amber, required)
 * - Email users see phone collection prompt (gray, optional with skip)
 * - Success screen messaging adapts based on contact method
 * - ContactCollect calls /api/public/patient/update-contact correctly
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { CalBookingConfirm } from '@/features/therapists/components/CalBookingConfirm';
import type { CalBookingState, CalBookingActions } from '@/features/therapists/hooks/useCalBooking';
import type { CalBookingKind } from '@/contracts/cal';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock VerifiedPhoneInput to avoid css import issues
vi.mock('@/components/VerifiedPhoneInput', () => ({
  VerifiedPhoneInput: ({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) => (
    React.createElement('input', {
      'data-testid': 'phone-input',
      id,
      type: 'tel',
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    })
  ),
}));

function makeState(overrides: Partial<CalBookingState> = {}): CalBookingState {
  return {
    slots: [],
    slotsLoading: false,
    slotsError: null,
    slotsUnavailable: false,
    selectedSlot: { date_iso: '2026-02-10', time_label: '14:00', time_utc: '2026-02-10T13:00:00Z' },
    hasAttemptedFetch: true,
    session: null,
    sessionLoading: false,
    step: 'success',
    name: '',
    contactMethod: 'email',
    contactValue: '',
    verificationCode: '',
    verifyLoading: false,
    verifyError: null,
    bookingRetryCount: 0,
    locationType: 'video',
    notes: '',
    bookingLoading: false,
    bookingError: null,
    bookingResult: {
      id: 1,
      uid: 'test-uid-123',
      eventTypeId: 100,
      userId: 1,
      startTime: '2026-02-10T13:00:00Z',
      endTime: '2026-02-10T13:50:00Z',
      status: 'ACCEPTED',
      metadata: { videoCallUrl: 'https://cal.example.com/video/test' },
    },
    ...overrides,
  };
}

const mockActions: CalBookingActions = {
  selectSlot: vi.fn(),
  clearSlot: vi.fn(),
  proceedToVerify: vi.fn(),
  backToSlots: vi.fn(),
  goToFallback: vi.fn(),
  setName: vi.fn(),
  setContactMethod: vi.fn(),
  setContactValue: vi.fn(),
  setVerificationCode: vi.fn(),
  sendCode: vi.fn(),
  verifyCode: vi.fn(),
  redirectToCal: vi.fn(),
  handleBooking: vi.fn(),
  retrySlotsFetch: vi.fn(),
  setLocationType: vi.fn(),
  setNotes: vi.fn(),
  createNativeBooking: vi.fn(),
  backToVerify: vi.fn(),
  reset: vi.fn(),
};

const defaultProps = {
  therapistName: 'Test Therapeut',
  bookingKind: 'intro' as CalBookingKind,
  sessionPrice: 120,
};

function renderComponent(state: CalBookingState) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(CalBookingConfirm, { state, actions: mockActions, ...defaultProps })
    );
  });
  return {
    container,
    unmount: () => { act(() => { root.unmount(); }); container.remove(); },
  };
}

describe('CalBookingConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: { updated: true, confirmation_sent: true }, error: null }),
    });
  });

  describe('Phone-only user (needs email)', () => {
    it('shows email collection prompt', () => {
      const state = makeState({
        session: { verified: true, contact_method: 'phone', contact_value: '+4917612345678', patient_id: 'p1' },
      });

      const { container, unmount } = renderComponent(state);

      expect(container.textContent).toContain('E-Mail-Adresse hinzufügen');
      expect(container.textContent).toContain('Buchungsbestätigung');
      expect(container.querySelector('input[type="email"]')).toBeTruthy();
      unmount();
    });

    it('shows conditional messaging before email is added', () => {
      const state = makeState({
        session: { verified: true, contact_method: 'phone', contact_value: '+4917612345678', patient_id: 'p1' },
      });

      const { container, unmount } = renderComponent(state);

      expect(container.textContent).toContain('Nach Eingabe deiner E-Mail erhältst du');
      unmount();
    });

    it('detects phone-only from verification contactMethod (new user)', () => {
      const state = makeState({
        session: { verified: false },
        contactMethod: 'phone',
      });

      const { container, unmount } = renderComponent(state);

      expect(container.textContent).toContain('E-Mail-Adresse hinzufügen');
      unmount();
    });

    it('calls update-contact API with email and booking_uid on submit', async () => {
      const state = makeState({
        session: { verified: true, contact_method: 'phone', contact_value: '+4917612345678', patient_id: 'p1' },
      });

      const { container, unmount } = renderComponent(state);

      const input = container.querySelector('input[type="email"]') as HTMLInputElement;
      // Use native setter to trigger React's onChange via synthetic event
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      act(() => {
        nativeSetter.call(input, 'patient@example.com');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      const submitBtn = Array.from(container.querySelectorAll('button'))
        .find(b => b.textContent?.includes('Senden'));

      await act(async () => {
        submitBtn?.click();
        // Wait for async fetch
        await new Promise(r => setTimeout(r, 50));
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/public/patient/update-contact',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'patient@example.com',
            booking_uid: 'test-uid-123',
          }),
        })
      );
      unmount();
    });
  });

  describe('Email user (optionally adds phone)', () => {
    it('shows optional phone collection prompt', () => {
      const state = makeState({
        session: { verified: true, contact_method: 'email', contact_value: 'test@example.com', patient_id: 'p1' },
      });

      const { container, unmount } = renderComponent(state);

      expect(container.textContent).toContain('SMS-Erinnerungen erhalten?');
      expect(container.textContent).toContain('Nein danke');
      unmount();
    });

    it('shows standard messaging for email users', () => {
      const state = makeState({
        session: { verified: true, contact_method: 'email', contact_value: 'test@example.com', patient_id: 'p1' },
      });

      const { container, unmount } = renderComponent(state);

      expect(container.textContent).toContain('Du erhältst in Kürze');
      unmount();
    });

    it('hides phone prompt after clicking "Nein danke"', () => {
      const state = makeState({
        session: { verified: true, contact_method: 'email', contact_value: 'test@example.com', patient_id: 'p1' },
      });

      const { container, unmount } = renderComponent(state);

      expect(container.textContent).toContain('SMS-Erinnerungen erhalten?');

      const skipBtn = Array.from(container.querySelectorAll('button'))
        .find(b => b.textContent?.includes('Nein danke'));

      act(() => { skipBtn?.click(); });

      expect(container.textContent).not.toContain('SMS-Erinnerungen erhalten?');
      unmount();
    });
  });

  describe('Booking in progress', () => {
    it('shows loading spinner during booking', () => {
      const state = makeState({ step: 'booking' });

      const { container, unmount } = renderComponent(state);

      expect(container.textContent).toContain('Termin wird gebucht...');
      unmount();
    });
  });

  describe('Success screen basics', () => {
    it('shows success message with date and time', () => {
      const state = makeState({
        session: { verified: true, contact_method: 'email', contact_value: 'test@example.com', patient_id: 'p1' },
      });

      const { container, unmount } = renderComponent(state);

      expect(container.textContent).toContain('Dein Termin ist gebucht!');
      expect(container.textContent).toContain('14:00 Uhr');
      unmount();
    });

    it('shows video link when available', () => {
      const state = makeState({
        session: { verified: true, contact_method: 'email', contact_value: 'test@example.com', patient_id: 'p1' },
      });

      const { container, unmount } = renderComponent(state);

      expect(container.textContent).toContain('Video-Link');
      const link = container.querySelector('a[href*="cal.example.com"]');
      expect(link).toBeTruthy();
      unmount();
    });

    it('calls reset when close button clicked', () => {
      const state = makeState({
        session: { verified: true, contact_method: 'email', contact_value: 'test@example.com', patient_id: 'p1' },
      });

      const { container, unmount } = renderComponent(state);

      const closeBtn = Array.from(container.querySelectorAll('button'))
        .find(b => b.textContent?.includes('Schließen'));

      act(() => { closeBtn?.click(); });
      expect(mockActions.reset).toHaveBeenCalled();
      unmount();
    });
  });
});
