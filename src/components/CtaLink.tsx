'use client';

import * as React from 'react';
import { buildEventId } from '@/lib/analytics';
import { getAttribution } from '@/lib/attribution';

interface CtaLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  eventType: string;
  eventId?: string;
}

const CtaLink = React.forwardRef<HTMLAnchorElement, CtaLinkProps>(
  ({ eventType, eventId, onClick, children, ...rest }, ref) => {
    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLAnchorElement>) => {
        try {
          const source = (e.currentTarget as HTMLAnchorElement).getAttribute('data-cta') || 'cta';
          const builtId =
            eventId || buildEventId(typeof window !== 'undefined' ? window.location.pathname : '', source, 'click');
          const attrs = getAttribution();
          const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
          const href = (e.currentTarget as HTMLAnchorElement).href;
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
            type: eventType,
            id: builtId,
            title: builtId,
            ...attrs,
            properties: { page_path: pagePath, source, href, variant },
          };
          // Prefer sendBeacon when available
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
        onClick?.(e);
      },
      [eventType, eventId, onClick]
    );

    return (
      <a ref={ref} data-cta-handled="true" {...rest} onClick={handleClick}>
        {children}
      </a>
    );
  }
);

CtaLink.displayName = 'CtaLink';

export default CtaLink;
