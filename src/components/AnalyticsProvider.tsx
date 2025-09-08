'use client';

import { Analytics } from '@vercel/analytics/react';

export default function AnalyticsProvider() {
  return (
    <Analytics
      beforeSend={(event) => {
        // Redact sensitive patient/admin pages from analytics
        if (event.url.includes('/match/') || event.url.includes('/admin/')) {
          return null;
        }
        return event;
      }}
    />
  );
}
