import { z, type ZodSchema } from 'zod';
import { safeJson } from '@/lib/http';

// Shared schema that both frontend and backend can import
export const leadSubmissionSchema = z.object({
  email: z.string().email(),
  consent_share_with_therapists: z.literal(true),
  privacy_version: z.string().min(1),
  // Optional-but-commonly-present fields
  name: z.string().min(1).optional(),
  type: z.enum(['patient', 'therapist']).default('patient').optional(),
  session_id: z.string().optional(),
  session_preference: z.enum(['online', 'in_person']).optional(),
  // For 'either' selection, the client may send both values here
  session_preferences: z.array(z.enum(['online', 'in_person'])).min(1).max(2).optional(),
  form_session_id: z.string().optional(),
  confirm_redirect_path: z.string().optional(),
});

// Middleware-style helper for API routes (server only)
export function validateContract<TSchema extends ZodSchema>(schema: TSchema) {
  return async (req: Request) => {
    const body = await req.json().catch(() => undefined);
    const result = schema.safeParse(body);
    if (!result.success) {
      console.error('Contract violation:', result.error);
      return safeJson({ data: null, error: 'Contract validation failed', details: result.error.flatten() }, { status: 400 });
    }
    return result.data as z.infer<TSchema>;
  };
}
