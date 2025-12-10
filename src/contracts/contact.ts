import { z } from 'zod';
import {
  Email,
  Phone,
  NonEmptyString,
  OptionalString,
  SessionPreference,
  UUID,
} from './shared';

// ============================================================================
// PATIENT CONTACT REQUEST
// POST /api/public/contact
// ============================================================================

export const ContactType = z.enum(['booking', 'consultation']);
export type ContactType = z.infer<typeof ContactType>;

export const ContactMethod = z.enum(['email', 'phone']);
export type ContactMethod = z.infer<typeof ContactMethod>;

export const PatientContactInput = z.object({
  therapist_id: UUID,
  contact_type: ContactType,
  patient_name: NonEmptyString,
  patient_email: Email.optional(),
  patient_phone: Phone.optional(),
  contact_method: ContactMethod,
  patient_reason: NonEmptyString,
  patient_message: OptionalString,
  session_format: SessionPreference.optional(),
  session_id: UUID.optional(),
  idempotency_key: z.string().optional(),
}).refine(
  data => (data.contact_method === 'email' && data.patient_email) || 
          (data.contact_method === 'phone' && data.patient_phone),
  { message: 'E-Mail oder Telefonnummer muss zur Kontaktmethode passen' }
);

export type PatientContactInput = z.infer<typeof PatientContactInput>;

export const PatientContactOutput = z.object({
  success: z.boolean(),
  patient_id: UUID,
  requires_verification: z.boolean(),
  contact_method: ContactMethod,
});

export type PatientContactOutput = z.infer<typeof PatientContactOutput>;

// ============================================================================
// MATCH CONTACT (from matches page)
// POST /api/public/matches/[uuid]/contact
// ============================================================================

export const MatchContactInput = z.object({
  therapist_id: UUID,
  contact_type: ContactType.default('consultation'),
  message: OptionalString,
  session_format: SessionPreference.optional(),
  slot_id: UUID.optional(),
});

export type MatchContactInput = z.infer<typeof MatchContactInput>;
