import { z } from 'zod';
import { OptionalString } from './shared';

export const TwilioIncomingSmsPayload = z
  .object({
    From: OptionalString,
    To: OptionalString,
    Body: OptionalString,
    MessageSid: OptionalString,
  })
  .passthrough();

export type TwilioIncomingSmsPayload = z.infer<typeof TwilioIncomingSmsPayload>;
