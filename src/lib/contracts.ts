import { z, type ZodSchema } from 'zod';
import { safeJson } from '@/lib/http';

// Shared schema that both frontend and backend can import
// EARTH-191: Support both email and phone as primary contact
export const leadSubmissionSchema = z.object({
  // Contact: either email OR phone_number required (validated with refine below)
  email: z.string().email().optional(),
  // Phone validation: E.164 format (e.g., +4915212345678), min 9 chars (+ plus 8 digits)
  phone_number: z.string().min(9).startsWith('+').optional(),
  contact_method: z.enum(['email', 'phone']).optional(),
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
}).refine(
  (data) => data.email || data.phone_number,
  { message: 'Either email or phone_number is required' }
);

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
