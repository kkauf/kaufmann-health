'use client';

import { useEffect } from 'react';
import { getAttribution } from '@/lib/attribution';

export default function DirectoryAnalytics() {
  useEffect(() => {
    try {
      const attrs = getAttribution();
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
      const variant = (() => {
        try {
          const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
          const v = (sp.get('variant') || sp.get('v') || '').toLowerCase() || undefined;
          if (v) {
            try { window.localStorage?.setItem('test1_variant', v); } catch {}
            return v;
          }
          if (typeof window !== 'undefined') {
            return window.localStorage?.getItem('test1_variant') || undefined;
          }
        } catch {}
        return undefined;
      })();
      const payload = {
        type: 'directory_viewed',
        ...attrs,
        properties: { page_path: pagePath, variant },
      };
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const nav = navigator as Navigator & { sendBeacon?: (url: string, data?: BodyInit | null) => boolean };
        nav.sendBeacon?.('/api/events', blob);
      } else {
        fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  }, []);

  return null;
}
