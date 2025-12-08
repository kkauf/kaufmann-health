// Character limits for therapist profile fields
// These are shared between client and server to prevent mismatches
// 
// Consumers:
// - Client: /app/portal/EditProfileForm.tsx (UI validation, character counters)
// - Server: /app/api/public/therapists/[id]/profile/route.ts (POST validation)
// 
// Note: Onboarding ProfileForm.tsx uses legacy approach_text field, not these structured fields

export const PROFILE_LIMITS = {
  who_comes_to_me: { recommended: 200, max: 220 },
  session_focus: { recommended: 250, max: 275 },
  first_session: { recommended: 200, max: 220 },
  about_me: { recommended: 150, max: 165 },
} as const;

// Server-side validation limits (max values)
export const SERVER_PROFILE_LIMITS = {
  who_comes_to_me: PROFILE_LIMITS.who_comes_to_me.max,
  session_focus: PROFILE_LIMITS.session_focus.max,
  first_session: PROFILE_LIMITS.first_session.max,
  about_me: PROFILE_LIMITS.about_me.max,
} as const;
