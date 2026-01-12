import { z } from 'zod';
import { OptionalString, UUID } from './shared';

export const CalBookingKind = z.enum(['intro', 'full_session']);
export type CalBookingKind = z.infer<typeof CalBookingKind>;

export const CalBookingSource = z.enum(['directory', 'questionnaire']);
export type CalBookingSource = z.infer<typeof CalBookingSource>;

const CalBool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => (typeof v === 'string' ? v === 'true' || v === '1' : v));

export const CalKhMetadata = z
  .object({
    kh_patient_id: UUID.optional(),
    kh_therapist_id: UUID.optional(),
    kh_match_id: UUID.optional(),
    kh_form_session_id: UUID.optional(),
    kh_booking_kind: CalBookingKind.optional(),
    kh_source: CalBookingSource.optional(),
    kh_test: CalBool.optional(),
    kh_gclid: OptionalString,
    kh_utm_source: OptionalString,
    kh_utm_medium: OptionalString,
    kh_utm_campaign: OptionalString,
    kh_utm_term: OptionalString,
    kh_utm_content: OptionalString,
  })
  .passthrough();

export type CalKhMetadata = z.infer<typeof CalKhMetadata>;

// Accept ANY trigger event from Cal.com - we log everything
export const CalWebhookTriggerEvent = z.string().min(1);

// Events we process into cal_bookings table
export const CalWebhookProcessableEvent = z.enum([
  'BOOKING_CREATED',
  'BOOKING_RESCHEDULED',
  'BOOKING_CANCELLED',
]);

// No-show events for future automation (EARTH-TBD)
export const CalWebhookNoShowEvent = z.enum([
  'BOOKING_NO_SHOW_UPDATED',
  'AFTER_HOSTS_CAL_VIDEO_NO_SHOW',
  'AFTER_GUESTS_CAL_VIDEO_NO_SHOW',
]);

export type CalWebhookTriggerEvent = z.infer<typeof CalWebhookTriggerEvent>;

export const CalWebhookOrganizer = z
  .object({
    id: z.union([z.number().int(), z.string()]).optional(),
    username: OptionalString,
    name: OptionalString,
    email: OptionalString,
  })
  .passthrough();

export type CalWebhookOrganizer = z.infer<typeof CalWebhookOrganizer>;

export const CalWebhookAttendee = z
  .object({
    email: OptionalString,
    name: OptionalString,
    phone: OptionalString,
  })
  .passthrough();

export type CalWebhookAttendee = z.infer<typeof CalWebhookAttendee>;

export const CalWebhookBookingPayload = z
  .object({
    uid: z.string().optional(), // Optional for ping tests
    eventTypeId: z.union([z.number().int(), z.string()]).nullable().optional(),
    // Cal.com may send various datetime formats - accept any string
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    attendees: z.array(CalWebhookAttendee).optional(),
    organizer: CalWebhookOrganizer.optional(),
    metadata: CalKhMetadata.optional(),
    status: OptionalString,
  })
  .passthrough();

export type CalWebhookBookingPayload = z.infer<typeof CalWebhookBookingPayload>;

export const CalWebhookBody = z
  .object({
    triggerEvent: CalWebhookTriggerEvent,
    // Cal.com may send various datetime formats
    createdAt: z.string().optional(),
    payload: CalWebhookBookingPayload,
  })
  .passthrough();

export type CalWebhookBody = z.infer<typeof CalWebhookBody>;

export const CAL_WEBHOOK_SIGNATURE_HEADER = 'x-cal-signature-256' as const;

export const CalWebhookSignature = z.string().min(1);
export type CalWebhookSignature = z.infer<typeof CalWebhookSignature>;

// ============================================================================
// CAL.COM SLOTS API (EARTH-256)
// GET /api/public/cal/slots - proxy to Cal.com v2 slots API
// ============================================================================

export const CalSlotsInput = z.object({
  therapist_id: z.string().uuid(),
  kind: CalBookingKind,
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD, defaults to today
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD, defaults to start+7d
  timeZone: z.string().optional(), // defaults to Europe/Berlin
});

export type CalSlotsInput = z.infer<typeof CalSlotsInput>;

export const CalSlot = z.object({
  time: z.string().datetime(), // ISO 8601 datetime
});

export type CalSlot = z.infer<typeof CalSlot>;

export const CalSlotsOutput = z.object({
  data: z
    .object({
      slots: z.record(z.string(), z.array(CalSlot)), // { "2025-01-06": [{ time: "..." }, ...] }
    })
    .nullable(),
  error: z.string().nullable(),
});

export type CalSlotsOutput = z.infer<typeof CalSlotsOutput>;

// Normalized slot format for KH UI (day-first grouping)
export const CalNormalizedSlot = z.object({
  date_iso: z.string(), // YYYY-MM-DD
  time_label: z.string(), // HH:MM (local time)
  time_utc: z.string().datetime(), // Full ISO timestamp for booking
});

export type CalNormalizedSlot = z.infer<typeof CalNormalizedSlot>;

export const CalSlotsResponse = z.object({
  data: z
    .object({
      slots: z.array(CalNormalizedSlot),
      therapist_id: z.string().uuid(),
      kind: CalBookingKind,
      cal_username: z.string(),
      event_type_slug: z.string(),
    })
    .nullable(),
  error: z.string().nullable(),
});

export type CalSlotsResponse = z.infer<typeof CalSlotsResponse>;

// ============================================================================
// CAL.COM EVENT TYPE LOOKUP
// Helper to map (username, kind) → eventTypeId for reserve/book
// ============================================================================

export const CalEventTypeInfo = z.object({
  eventTypeId: z.number().int(),
  slug: z.string(),
  title: z.string(),
  length: z.number().int(), // duration in minutes
  locations: z.array(
    z.object({
      type: z.string(),
      address: z.string().optional(),
    })
  ).optional(),
});

export type CalEventTypeInfo = z.infer<typeof CalEventTypeInfo>;
