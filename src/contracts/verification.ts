import { z } from 'zod';
import { UUID } from './shared';

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
  contact: z.string().min(1, 'Kontakt erforderlich'),
  contact_type: VerificationContactType,
  patient_id: UUID.optional(),
  
  // For redirect after verification
  redirect_path: z.string().optional(),
  form_session_id: UUID.optional(),
});

export type SendCodeInput = z.infer<typeof SendCodeInput>;

export const SendCodeOutput = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type SendCodeOutput = z.infer<typeof SendCodeOutput>;

// ============================================================================
// VERIFY CODE
// POST /api/public/verification/verify-code
// ============================================================================

export const VerifyCodeInput = z.object({
  contact: z.string().min(1, 'Kontakt erforderlich'),
  contact_type: VerificationContactType,
  code: z.string().min(4, 'Code zu kurz').max(10, 'Code zu lang'),
  
  // Optional context
  patient_id: UUID.optional(),
  form_session_id: UUID.optional(),
});

export type VerifyCodeInput = z.infer<typeof VerifyCodeInput>;

export const VerifyCodeOutput = z.object({
  success: z.boolean(),
  patient_id: UUID.optional(),
  verified: z.boolean().optional(),
  error: z.string().optional(),
});

export type VerifyCodeOutput = z.infer<typeof VerifyCodeOutput>;
