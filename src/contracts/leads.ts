import { z } from 'zod';
import {
  Email,
  Phone,
  NonEmptyString,
  OptionalString,
  City,
  GenderPreference,
  GermanGenderPreference,
  SessionPreference,
  GermanSessionPreference,
  UUID,
} from './shared';

// ============================================================================
// PATIENT LEAD SUBMISSION
// POST /api/public/leads
// ============================================================================

/**
 * Patient lead from signup form (German strings from UI)
 */
export const PatientLeadInput = z.object({
  name: NonEmptyString,
  email: Email.optional(),
  phone_number: Phone.optional(),
  city: City.optional(),
  issue: OptionalString,
  
  // These come in German from the form
  gender: GermanGenderPreference.optional(),
  session_preference: GermanSessionPreference.optional(),
  
  // UTM tracking
  utm_source: OptionalString,
  utm_medium: OptionalString,
  utm_campaign: OptionalString,
  campaign_source: OptionalString,
  campaign_variant: OptionalString,
  landing_page: OptionalString,
  gclid: OptionalString,
  
  // Form session reference
  form_session_id: UUID.optional(),
  confirm_redirect_path: OptionalString,
  
  // Direct booking flow
  therapist_id: UUID.optional(),
  slot_id: UUID.optional(),
}).refine(data => data.email || data.phone_number, {
  message: 'E-Mail oder Telefonnummer erforderlich',
});

export type PatientLeadInput = z.infer<typeof PatientLeadInput>;

/**
 * What the leads API returns
 */
export const PatientLeadOutput = z.discriminatedUnion('requiresConfirmation', [
  z.object({
    id: UUID,
    requiresConfirmation: z.literal(true),
  }),
  z.object({
    id: UUID,
    requiresConfirmation: z.literal(false),
    matchesUrl: z.string().optional(),
  }),
]);

export type PatientLeadOutput = z.infer<typeof PatientLeadOutput>;

// ============================================================================
// THERAPIST LEAD SUBMISSION
// POST /api/public/leads (type: 'therapist')
// ============================================================================

export const TherapistLeadInput = z.object({
  type: z.literal('therapist'),
  name: NonEmptyString,
  email: Email,
  phone_number: Phone.optional(),
  city: City.optional(),
  modalities: z.array(z.string()).optional(),
  website: z.string().url().optional(),
});

export type TherapistLeadInput = z.infer<typeof TherapistLeadInput>;

// ============================================================================
// FORM SESSION (progressive form data)
// ============================================================================

export const FormSessionData = z.object({
  name: OptionalString,
  email: Email.optional(),
  city: City.optional(),
  issue: OptionalString,
  gender: GermanGenderPreference.optional(),
  session_preference: GermanSessionPreference.optional(),
  schwerpunkte: z.array(z.string()).optional(),
  methods: z.array(z.string()).optional(),
  time_slots: z.array(z.string()).optional(),
  start_timing: OptionalString,
  completed_at: z.string().optional(),
});

export type FormSessionData = z.infer<typeof FormSessionData>;

export const LeadIdParam = z.object({
  id: UUID,
});

export type LeadIdParam = z.infer<typeof LeadIdParam>;

export const LeadFormCompletedParams = z.object({
  id: UUID,
});

export type LeadFormCompletedParams = z.infer<typeof LeadFormCompletedParams>;

export const LeadFormCompletedOutput = z.object({
  ok: z.literal(true),
});

export type LeadFormCompletedOutput = z.infer<typeof LeadFormCompletedOutput>;

export const LeadConfirmQuery = z.object({
  token: z.string().min(1),
  id: z.string().min(1),
  fs: z
    .string()
    .optional()
    .transform((v) => (v && /^[0-9a-fA-F-]{36}$/.test(v) ? v : undefined)),
  redirect: z
    .string()
    .optional()
    .transform((v) => (typeof v === 'string' ? v.trim() : undefined))
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || (v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/api'))),
});

export type LeadConfirmQuery = z.infer<typeof LeadConfirmQuery>;
