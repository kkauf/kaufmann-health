import { z } from 'zod';

export const TherapistProfilesImagePathSegment = z
  .string()
  .min(1)
  .max(128)
  .refine((seg) => seg !== '.' && seg !== '..', 'Invalid path segment')
  .refine((seg) => !seg.includes('\\'), 'Invalid path segment')
  .refine((seg) => /^[A-Za-z0-9._-]+$/.test(seg), 'Invalid path segment');

export const TherapistProfilesImagePathParams = z.object({
  path: z.array(TherapistProfilesImagePathSegment).min(1),
});

export type TherapistProfilesImagePathParams = z.infer<typeof TherapistProfilesImagePathParams>;
