import { z } from 'zod';
import { OptionalString } from './shared';

export const CronAuthInput = z
  .object({
    authorization: OptionalString,
    cron_secret_header: OptionalString,
    vercel_signature: OptionalString,
    vercel_cron: OptionalString,
    token: OptionalString,
  })
  .passthrough();

export type CronAuthInput = z.infer<typeof CronAuthInput>;

export const AdminEmailPreviewTemplate = z.enum([
  'rich_therapist',
  'selection_nudge',
  'feedback_request',
  'email_confirmation',
  'all',
]);

export type AdminEmailPreviewTemplate = z.infer<typeof AdminEmailPreviewTemplate>;

export const AdminEmailPreviewPostInput = z
  .object({
    template: AdminEmailPreviewTemplate.optional(),
    send: z.boolean().optional(),
  })
  .passthrough();

export type AdminEmailPreviewPostInput = z.infer<typeof AdminEmailPreviewPostInput>;

const Limit = z.coerce.number().int().min(1).max(1000);

export const AdminCronLimitInput = z
  .object({
    limit: Limit.optional(),
  })
  .passthrough();

export type AdminCronLimitInput = z.infer<typeof AdminCronLimitInput>;

export const AdminConfirmationRemindersInput = z
  .object({
    threshold: z.enum(['24h', '72h']).optional(),
    limit: Limit.optional(),
  })
  .passthrough();

export type AdminConfirmationRemindersInput = z.infer<typeof AdminConfirmationRemindersInput>;

export const AdminSmsCadenceInput = z
  .object({
    stage: z.enum(['day2', 'day5', 'day10']).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    dry: z
      .union([z.boolean(), z.enum(['true', 'false']), z.enum(['1', '0'])])
      .transform((v) => (typeof v === 'string' ? v === 'true' || v === '1' : Boolean(v)))
      .optional(),
  })
  .passthrough();

export type AdminSmsCadenceInput = z.infer<typeof AdminSmsCadenceInput>;

export const AdminAlertsSystemInput = z
  .object({
    minutes: z.coerce.number().int().min(1).max(60).optional(),
  })
  .passthrough();

export type AdminAlertsSystemInput = z.infer<typeof AdminAlertsSystemInput>;

export const AdminAlertsNewLeadsInput = z
  .object({
    hours: z.coerce.number().int().min(1).max(24).optional(),
  })
  .passthrough();

export type AdminAlertsNewLeadsInput = z.infer<typeof AdminAlertsNewLeadsInput>;

export const AdminUserErrorsInput = z
  .object({
    hours: z.coerce.number().int().min(1).max(168).optional(),
  })
  .passthrough();

export type AdminUserErrorsInput = z.infer<typeof AdminUserErrorsInput>;

// ============================================================================
// PATCH /api/admin/therapists/[id]
// Admin therapist update (verification, photo approval, profile edits)
// ============================================================================

// 'rejected' = transient, profile needs fixes (documents, photo, approach text)
// 'declined' = terminal, not accepted into network (e.g., missing certification)
export const AdminTherapistStatus = z.enum(['pending_verification', 'verified', 'rejected', 'declined']);
export type AdminTherapistStatus = z.infer<typeof AdminTherapistStatus>;

export const AdminTherapistPatchInput = z
  .object({
    status: AdminTherapistStatus.optional(),
    verification_notes: z.string().optional(),
    approve_profile: z.boolean().optional(),
    approach_text: z.string().max(500).optional(),
    practice_address: z.string().optional(),
    // Admin can fix typos in city field
    city: z.string().max(100).optional(),
    profile: z
      .object({
        practice_address: z.string().optional(),
      })
      .optional(),
    // Cal.com integration fields (admin can manually set/override)
    cal_username: z.string().max(100).optional(),
    cal_enabled: z.boolean().optional(),
    // Booking gating: require intro session before full session booking
    requires_intro_before_booking: z.boolean().optional(),
    // Hide profile from public directory (e.g., bouncing emails, inactive)
    hidden: z.boolean().optional(),
  })
  .passthrough();

export type AdminTherapistPatchInput = z.infer<typeof AdminTherapistPatchInput>;

export const AdminTherapistPatchOutput = z.object({
  data: z
    .object({
      ok: z.boolean(),
      cal_provisioned: z.boolean().optional(),
      cal_username: z.string().optional(),
    })
    .nullable(),
  error: z.string().nullable(),
});

export type AdminTherapistPatchOutput = z.infer<typeof AdminTherapistPatchOutput>;
export const AdminUserErrorsDigestInput = z
  .object({
    hours: z.coerce.number().int().min(1).max(168).optional(),
  })
  .passthrough();

export type AdminUserErrorsDigestInput = z.infer<typeof AdminUserErrorsDigestInput>;

export const AdminErrorsQueryInput = z
  .object({
    since_hours: z.coerce.number().int().min(1).max(720).optional(),
    source: z.string().trim().optional(),
    type: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    levels: z.string().trim().optional(),
    level: z.string().trim().optional(),
  })
  .passthrough();

export type AdminErrorsQueryInput = z.infer<typeof AdminErrorsQueryInput>;
