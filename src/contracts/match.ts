import { z } from 'zod';
import { NonEmptyString } from './shared';

// ============================================================================
// THERAPIST RESPOND TO MATCH
// POST /api/public/match/[uuid]/respond
// ============================================================================

export const MatchAction = z.enum(['accept', 'decline']);
export type MatchAction = z.infer<typeof MatchAction>;

export const TherapistRespondInput = z.object({
  action: MatchAction,
});

export type TherapistRespondInput = z.infer<typeof TherapistRespondInput>;

// ============================================================================
// PATIENT SELECT THERAPIST
// POST /api/public/match/[uuid]/select
// ============================================================================

export const PatientSelectInput = z.object({
  therapist_id: NonEmptyString,
});

export type PatientSelectInput = z.infer<typeof PatientSelectInput>;

export const TherapistResendMagicLinkInput = z.object({});
export type TherapistResendMagicLinkInput = z.infer<typeof TherapistResendMagicLinkInput>;

export const TherapistResendMagicLinkOutput = z.object({
  ok: z.boolean(),
});
export type TherapistResendMagicLinkOutput = z.infer<typeof TherapistResendMagicLinkOutput>;
