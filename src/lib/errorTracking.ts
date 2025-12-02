/**
 * Ultra-sensitive client-side error tracking for small-scale ops.
 * Tracks all user-facing errors (API failures, auth issues) to help
 * catch every lost user.
 * 
 * Usage: Call initErrorTracking() once in app layout or _app.
 */

import { getAttribution } from './attribution';

export type UserFacingError = {
  type: 'api_error' | 'auth_error' | 'network_error' | 'unhandled';
  status?: number;
  url?: string;
  message?: string;
  page_path?: string;
};

let isInitialized = false;

/**
 * Report a user-facing error to the backend
 */
export function reportError(error: UserFacingError): void {
  try {
    const attrs = getAttribution();
    const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
    
    const payload = {
      type: 'user_facing_error',
      ...attrs,
      properties: {
        error_type: error.type,
        status: error.status,
        url: error.url,
        message: error.message?.slice(0, 500), // Truncate long messages
        page_path: error.page_path || pagePath,
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
        
        reportError({
          type: isAuthError ? 'auth_error' : 'api_error',
          status: response.status,
          url: url.split('?')[0], // Strip query params
          message: response.statusText,
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
    
    reportError({
      type: 'unhandled',
      message: event.message,
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
