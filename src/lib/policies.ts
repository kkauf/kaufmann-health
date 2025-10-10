export { PRIVACY_VERSION } from '@/lib/privacy';
export { TERMS_VERSION } from '@/content/therapist-terms';

export function getConsentDefaults() {
  return {
    consent_share_with_therapists: true as const,
    privacy_version: (require('@/lib/privacy') as { PRIVACY_VERSION: string }).PRIVACY_VERSION,
  };
}
