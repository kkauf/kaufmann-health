"use client";

import { getCookieConsentValue, resetCookieConsentValue } from "react-cookie-consent";
import { CONSENT_COOKIE_NAME } from "./consent-constants";

/**
 * Returns true if the user granted consent via the cookie banner.
 * Falls back to false when value is missing or unknown.
 */
export function hasConsent(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const v = getCookieConsentValue(CONSENT_COOKIE_NAME) as unknown;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v === "true";
    return false;
  } catch {
    return false;
  }
}

/**
 * Resets the stored consent choice. Typically followed by a reload or by
 * toggling the banner's visible prop to show it again.
 */
export function resetConsent(): void {
  try {
    if (typeof window === "undefined") return;
    resetCookieConsentValue();
  } catch {}
}
