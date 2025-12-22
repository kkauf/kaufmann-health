export const ACTIVE_CITIES = new Set<string>(['berlin']);

// Absolute base URL for links in emails
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

// Always use production for email assets (images) - prevents 401s from password-protected staging
export const EMAIL_ASSETS_URL = 'https://www.kaufmann-health.de';

export const EMAIL_FROM_DEFAULT = 'kontakt@kaufmann-health.de';
