'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for catching React errors (including hydration mismatches).
 * Hydration errors often occur due to browser extensions modifying the DOM.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track the error
    try {
      const isHydrationError = 
        error.message.includes('insertBefore') ||
        error.message.includes('removeChild') ||
        error.message.includes('Hydration') ||
        error.message.includes('hydrat');

      navigator.sendBeacon?.(
        '/api/events',
        new Blob([JSON.stringify({
          type: 'react_error_boundary',
          properties: {
            error_message: error.message,
            error_name: error.name,
            is_hydration_error: isHydrationError,
            component_stack: errorInfo.componentStack?.slice(0, 500),
            page_path: typeof window !== 'undefined' ? window.location.pathname : '',
          },
        })], { type: 'application/json' })
      );
    } catch {
      // Ignore tracking errors
    }
  }

  handleRetry = () => {
    // Clear localStorage wizard state to get a fresh start
    try {
      localStorage.removeItem('kh_wizard_data');
      localStorage.removeItem('kh_wizard_step');
      localStorage.removeItem('kh_form_session_id');
    } catch {
      // Ignore storage errors
    }
    // Force a full page reload to recover from hydration errors
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isHydrationError = 
        this.state.error?.message.includes('insertBefore') ||
        this.state.error?.message.includes('removeChild');

      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-900 mb-2">
            {isHydrationError 
              ? 'Browser-Erweiterung hat einen Konflikt verursacht'
              : 'Ein Fehler ist aufgetreten'}
          </h2>
          <p className="text-sm text-amber-800 mb-4">
            {isHydrationError
              ? 'Eine Browser-Erweiterung (z.B. Werbeblocker, Übersetzer) hat möglicherweise einen Konflikt verursacht.'
              : 'Bitte versuche es erneut.'}
          </p>
          <Button onClick={this.handleRetry} className="bg-amber-600 hover:bg-amber-700">
            Seite neu laden
          </Button>
          {isHydrationError && (
            <p className="text-xs text-amber-600 mt-3">
              Tipp: Versuche, Browser-Erweiterungen für diese Seite zu deaktivieren.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
