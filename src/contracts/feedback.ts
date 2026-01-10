import { z } from 'zod';
import { UUID, OptionalString } from './shared';

// ============================================================================
// INTERVIEW INTEREST
// POST /api/public/feedback/interview-interest
// ============================================================================

/**
 * Interview interest submission from feedback page
 */
export const InterviewInterestInput = z.object({
  patient_id: UUID,
  source: OptionalString,
});

export type InterviewInterestInput = z.infer<typeof InterviewInterestInput>;
