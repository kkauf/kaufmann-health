# EARTH-203: Email Verification Decision

## Context

Bug #5 raised the question: Should email verification use magic links (like the Fragebogen flow) or verification codes (like SMS)?

## Decision: Use Verification Codes for Both

**Rationale:**

1. **Consistency**: SMS verification uses codes. Using codes for email too keeps the UX identical regardless of contact method.

2. **Simplicity**: Reusing existing `/api/public/verification/send-code` and `/api/public/verification/verify-code` endpoints means:
   - No new backend logic needed
   - No context-aware magic link routing
   - Same error handling and retry logic

3. **Modal Flow**: Verification codes work better in a modal context:
   - User stays in the modal throughout the flow
   - No navigation away to check email and click link
   - Faster perceived completion time

4. **Mobile UX**: On mobile, users can:
   - Copy code from SMS/email notification
   - iOS/Android auto-fill one-time codes
   - Stay in the same context

## Alternative Considered

**Magic Links** (like Fragebogen email confirmation):
- **Pros**: No code to type, one-click verification
- **Cons**: 
  - Requires context-aware routing (was user in Fragebogen or contacting therapist?)
  - User must leave modal, check email, click link, return to modal
  - More complex state management
  - Breaks modal flow continuity

## Implementation

The ContactModal uses:
- **Phone**: SMS code via Twilio (existing)
- **Email**: Email code via Resend (existing)
- Both use the same verification endpoints
- Same 6-digit code format
- Same retry/resend logic

## Future Consideration

If we want to add magic links for email verification in the contact flow:
1. Add `context` parameter to `/api/public/verification/send-code` ('fragebogen' | 'contact')
2. For 'contact' context, include `therapist_id` in magic link
3. Magic link redirects to modal state or auto-completes verification
4. Would require more complex state management and URL handling

For MVP, verification codes provide the best balance of simplicity and UX consistency.
