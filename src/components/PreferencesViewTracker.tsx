'use client';

import { useEffect } from 'react';
import { buildEventId } from '@/lib/analytics';
import { getAttribution } from '@/lib/attribution';

export function PreferencesViewTracker({ leadId }: { leadId?: string }) {
  useEffect(() => {
    try {
      const attrs = getAttribution();
      const id = buildEventId('/preferences', 'flow', 'view');
      const payload = { type: 'preferences_viewed', id, ...attrs, ...(leadId ? { lead_id: leadId } : {}) };
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, [leadId]);

  return null;
}
