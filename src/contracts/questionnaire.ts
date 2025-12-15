import { z } from 'zod';
import { OptionalString, UUID } from './shared';

export const QuestionnaireSubmitInput = z.object({
  start_timing: OptionalString,
  additional_info: OptionalString,
  modality_matters: z.boolean().optional(),
  methods: z.array(z.string()).optional(),
  schwerpunkte: z.array(z.string()).optional(),
  city: OptionalString,
  session_preference: z.enum(['online', 'in_person', 'either']).optional(),
  gender: OptionalString,
  time_slots: z.array(z.string()).optional(),
  form_session_id: UUID.optional(),
});

export type QuestionnaireSubmitInput = z.infer<typeof QuestionnaireSubmitInput>;

export const QuestionnaireSubmitOutput = z.object({
  patientId: UUID,
  matchesUrl: z.string().nullable(),
  matchQuality: z.enum(['exact', 'partial', 'none']),
});

export type QuestionnaireSubmitOutput = z.infer<typeof QuestionnaireSubmitOutput>;
