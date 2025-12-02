import { PRIVACY_VERSION } from '@/lib/privacy';
export { PRIVACY_VERSION, AGB_VERSION, IMPRESSUM_VERSION } from '@/lib/privacy';
export { TERMS_VERSION } from '@/content/therapist-terms';

export function getConsentDefaults() {
  return {
    consent_share_with_therapists: true as const,
    privacy_version: PRIVACY_VERSION,
  };
}
