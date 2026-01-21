'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface ActionResult {
  status: ActionStatus;
  message?: string;
  details?: Record<string, unknown>;
}

export function AdminQuickActions() {
  const [cacheStatus, setCacheStatus] = useState<ActionResult>({ status: 'idle' });

  const warmCache = async () => {
    setCacheStatus({ status: 'loading' });
    try {
      const res = await fetch('/api/admin/cal/warm-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await res.json();
      
      if (res.ok && data.ok) {
        setCacheStatus({
          status: 'success',
          message: `${data.success}/${data.total} therapists warmed in ${data.duration_ms}ms`,
          details: data,
        });
      } else {
        setCacheStatus({
          status: 'error',
          message: data.error || `HTTP ${res.status}`,
          details: data,
        });
      }
    } catch (err) {
      setCacheStatus({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // Reset after 10 seconds
    setTimeout(() => setCacheStatus({ status: 'idle' }), 10000);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={warmCache}
            disabled={cacheStatus.status === 'loading'}
            className="flex items-center gap-2"
          >
            {cacheStatus.status === 'loading' ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            Warm Cal Cache
          </Button>
          
          {cacheStatus.status === 'success' && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              {cacheStatus.message}
            </span>
          )}
          
          {cacheStatus.status === 'error' && (
            <span className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {cacheStatus.message}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Cal cache auto-warms every 10 min. Use this to manually refresh if booking shows fallback.
      </p>
    </div>
  );
}
