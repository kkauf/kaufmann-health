'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface MetabaseDashboardProps {
  dashboardKey: string;
}

export function MetabaseDashboard({ dashboardKey }: MetabaseDashboardProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUrl() {
      setEmbedUrl(null);
      setError(null);

      try {
        const res = await fetch(`/api/admin/metabase-embed?dashboard=${encodeURIComponent(dashboardKey)}`);
        const json = await res.json();
        if (cancelled) return;

        if (!res.ok || json.error) {
          setError(json.error || 'Failed to load dashboard');
          return;
        }

        setEmbedUrl(json.data.embedUrl);
      } catch {
        if (!cancelled) setError('Failed to fetch embed URL');
      }
    }

    fetchUrl();
    return () => { cancelled = true; };
  }, [dashboardKey]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <iframe
      src={embedUrl}
      className="w-full min-h-[800px] border-0 rounded-lg"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      title={`Metabase Dashboard: ${dashboardKey}`}
    />
  );
}
