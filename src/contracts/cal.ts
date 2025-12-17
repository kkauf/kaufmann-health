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

export const CalWebhookTriggerEvent = z.enum([
  'BOOKING_CREATED',
  'BOOKING_RESCHEDULED',
  'BOOKING_CANCELLED',
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
    uid: z.string().min(1),
    eventTypeId: z.union([z.number().int(), z.string()]).nullable().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
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
    createdAt: z.string().datetime().optional(),
    payload: CalWebhookBookingPayload,
  })
  .passthrough();

export type CalWebhookBody = z.infer<typeof CalWebhookBody>;

export const CAL_WEBHOOK_SIGNATURE_HEADER = 'x-cal-signature-256' as const;

export const CalWebhookSignature = z.string().min(1);
export type CalWebhookSignature = z.infer<typeof CalWebhookSignature>;
