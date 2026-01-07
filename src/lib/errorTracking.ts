/**
 * Ultra-sensitive client-side error tracking for small-scale ops.
 * Tracks all user-facing errors (API failures, auth issues) to help
 * catch every lost user.
 * 
 * Usage: Call initErrorTracking() once in app layout or _app.
 */

import { getAttribution } from './attribution';

function shouldIgnoreUnhandledMessage(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (m.includes('chunkloaderror')) return true;
  if (m.includes("cannot read properties of undefined") && m.includes("reading 'call'")) return true;
  if (m.includes('__firefox__')) return true;
  if (m.trim() === 'uncaught') return true;
  if (m.trim() === 'script error.' || m.trim() === 'script error') return true;
  return false;
}

export type UserFacingError = {
  type: 'api_error' | 'auth_error' | 'network_error' | 'unhandled';
  status?: number;
  url?: string;
  message?: string;
  page_path?: string;
  stack?: string;
  error_name?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
};

let isInitialized = false;

/**
 * Report a user-facing error to the backend
 */
export function reportError(error: UserFacingError): void {
  try {
    if (error.type === 'unhandled' && shouldIgnoreUnhandledMessage(error.message)) {
      return;
    }

    const attrs = getAttribution();
    const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
    const url = error.url || pagePath || undefined;

    // Best-effort questionnaire context (helps debug /fragebogen issues)
    let wizardStep: number | undefined;
    let formSessionId: string | undefined;
    try {
      if (typeof window !== 'undefined') {
        const rawStep = window.localStorage?.getItem('kh_wizard_step') || undefined;
        if (rawStep && /^\d+$/.test(rawStep)) wizardStep = Number(rawStep);
        formSessionId = window.localStorage?.getItem('kh_form_session_id') || undefined;
      }
    } catch {}
    
    const payload = {
      type: 'user_facing_error',
      ...attrs,
      properties: {
        error_type: error.type,
        status: error.status,
        url,
        message: error.message?.slice(0, 500), // Truncate long messages
        stack: error.stack?.slice(0, 1200),
        page_path: error.page_path || pagePath,
        ...(wizardStep ? { wizard_step: wizardStep } : {}),
        ...(formSessionId ? { form_session_id: formSessionId } : {}),
        error_name: error.error_name?.slice(0, 80),
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
    };
    
    // Use sendBeacon for reliability
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } else if (typeof fetch !== 'undefined') {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silent fail - we're in error handling, don't cause more errors
  }
}

/**
 * Wrap fetch to automatically track API errors
 */
function wrapFetch(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  
  const originalFetch = window.fetch;
  
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
    
    try {
      const response = await originalFetch(input, init);
      
      // Track 4xx and 5xx errors on our API endpoints
      // Skip 410 (Gone/Expired) - this is expected behavior for expired sessions/links
      if (!response.ok && url.startsWith('/api/') && response.status !== 410) {
        const isAuthError = response.status === 401 || response.status === 403;
        
        // Clone response to read body without consuming original
        // Extract actual error message from JSON response body
        let errorMessage = response.statusText || `HTTP ${response.status}`;
        try {
          const cloned = response.clone();
          const json = await cloned.json();
          // Our API returns { data: null, error: "actual message" }
          if (json?.error && typeof json.error === 'string') {
            errorMessage = json.error;
          }
        } catch {
          // Body not JSON or couldn't be read - use statusText
        }

        reportError({
          type: isAuthError ? 'auth_error' : 'api_error',
          status: response.status,
          url: url.split('?')[0], // Strip query params
          message: errorMessage,
        });
      }
      
      return response;
    } catch (error) {
      // Network errors (offline, CORS, etc.)
      if (url.startsWith('/api/')) {
        reportError({
          type: 'network_error',
          url: url.split('?')[0],
          message: error instanceof Error ? error.message : 'Network error',
        });
      }
      throw error;
    }
  };
}

/**
 * Track unhandled promise rejections
 */
function trackUnhandledRejections(): void {
  if (typeof window === 'undefined') return;
  
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    reportError({
      type: 'unhandled',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error_name: error instanceof Error ? error.name : undefined,
    });
  });
}

/**
 * Track uncaught errors
 */
function trackUncaughtErrors(): void {
  if (typeof window === 'undefined') return;
  
  window.addEventListener('error', (event) => {
    // Skip errors from extensions/third-party scripts
    if (event.filename && !event.filename.includes(window.location.origin)) {
      return;
    }

    const err = (event as ErrorEvent).error;
    const message = err instanceof Error ? err.message : event.message;
    
    reportError({
      type: 'unhandled',
      message,
      stack: err instanceof Error ? err.stack : undefined,
      error_name: err instanceof Error ? err.name : undefined,
      filename: event.filename || undefined,
      lineno: typeof event.lineno === 'number' ? event.lineno : undefined,
      colno: typeof event.colno === 'number' ? event.colno : undefined,
    });
  });
}

/**
 * Initialize all error tracking. Call once on app mount.
 */
export function initErrorTracking(): void {
  if (isInitialized) return;
  if (typeof window === 'undefined') return;
  
  isInitialized = true;
  wrapFetch();
  trackUnhandledRejections();
  trackUncaughtErrors();
}

/**
 * Helper to manually report specific error scenarios
 */
export const ErrorTypes = {
  AUTH_REQUIRED: (url: string) => reportError({ type: 'auth_error', status: 401, url, message: 'Verification required' }),
  RATE_LIMITED: (url: string) => reportError({ type: 'api_error', status: 429, url, message: 'Rate limited' }),
  NOT_FOUND: (url: string) => reportError({ type: 'api_error', status: 404, url, message: 'Not found' }),
} as const;
