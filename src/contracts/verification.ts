import { z } from 'zod';
import { NonEmptyString, OptionalString, SessionPreference, UUID } from './shared';

// ============================================================================
// VERIFICATION
// ============================================================================

export const VerificationContactType = z.enum(['email', 'phone']);
export type VerificationContactType = z.infer<typeof VerificationContactType>;

// ============================================================================
// SEND VERIFICATION CODE
// POST /api/public/verification/send-code
// ============================================================================

export const SendCodeInput = z.object({
  contact: NonEmptyString,
  contact_type: VerificationContactType,
  lead_id: OptionalString,
  form_session_id: OptionalString,
  redirect: OptionalString,
  name: OptionalString,
  draft_contact: z
    .object({
      therapist_id: UUID,
      contact_type: z.enum(['booking', 'consultation']),
      patient_reason: OptionalString,
      patient_message: OptionalString,
      session_format: SessionPreference.optional(),
    })
    .optional(),
  draft_booking: z
    .object({
      therapist_id: UUID,
      date_iso: OptionalString,
      time_label: OptionalString,
      format: SessionPreference.optional(),
    })
    .optional(),
}).passthrough();

export type SendCodeInput = z.infer<typeof SendCodeInput>;

export const SendCodeOutput = z.object({
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().nullable().optional(),
  success: z.boolean().optional(),
});

export type SendCodeOutput = z.infer<typeof SendCodeOutput>;

// ============================================================================
// VERIFY CODE
// POST /api/public/verification/verify-code
// ============================================================================

export const VerifyCodeInput = z.object({
  contact: NonEmptyString,
  contact_type: VerificationContactType,
  code: NonEmptyString,
}).passthrough();

export type VerifyCodeInput = z.infer<typeof VerifyCodeInput>;

export const VerifyCodeOutput = z.object({
  success: z.boolean(),
  patient_id: z.string().optional(),
  verified: z.boolean().optional(),
  error: z.string().optional(),
});

export type VerifyCodeOutput = z.infer<typeof VerifyCodeOutput>;
