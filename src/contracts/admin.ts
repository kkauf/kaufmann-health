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

export const AdminUserErrorsDigestInput = z
  .object({
    hours: z.coerce.number().int().min(1).max(168).optional(),
  })
  .passthrough();

export type AdminUserErrorsDigestInput = z.infer<typeof AdminUserErrorsDigestInput>;
