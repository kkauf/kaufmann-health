'use client';

import * as React from 'react';

interface CtaLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  eventType: string;
  eventId?: string;
}

const CtaLink = React.forwardRef<HTMLAnchorElement, CtaLinkProps>(
  ({ eventType, eventId, onClick, children, ...rest }, ref) => {
    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLAnchorElement>) => {
        try {
          const payload = { type: eventType, id: eventId, title: eventId };
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
      <a ref={ref} {...rest} onClick={handleClick}>
        {children}
      </a>
    );
  }
);

CtaLink.displayName = 'CtaLink';

export default CtaLink;
