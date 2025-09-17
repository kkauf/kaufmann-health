"use client";

import { useEffect, useRef } from "react";
import { buildEventId } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";

export default function PageAnalytics({ qualifier }: { qualifier?: string } = {}) {
  const sent = useRef<{ view?: boolean; depths: Record<number, boolean> }>({
    view: false,
    depths: {},
  });

  useEffect(() => {
    // Page view on mount
    try {
      const attrs = getAttribution();
      const id = buildEventId(
        typeof window !== "undefined" ? window.location.pathname : "",
        "page",
        "view",
        qualifier
      );
      const payload = { type: "page_view", id, title: id, ...attrs };
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
      sent.current.view = true;
    } catch {}

    // Scroll depth tracking (25/50/75/100)
    const thresholds = [25, 50, 75, 100];
    const onScroll = () => {
      try {
        const doc = document.documentElement;
        const body = document.body;
        const scrollTop = (doc && doc.scrollTop) || (body && body.scrollTop) || 0;
        const scrollHeight = (doc && doc.scrollHeight) || (body && body.scrollHeight) || 1;
        const clientHeight = doc.clientHeight || window.innerHeight;
        const progress = Math.min(100, Math.round(((scrollTop + clientHeight) / scrollHeight) * 100));
        for (const t of thresholds) {
          if (progress >= t && !sent.current.depths[t]) {
            sent.current.depths[t] = true;
            const attrs = getAttribution();
            const id = buildEventId(
              typeof window !== "undefined" ? window.location.pathname : "",
              "scroll",
              `${t}`
            );
            fetch("/api/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "scroll_depth", id, title: `${t}%`, ...attrs }),
              keepalive: true,
            }).catch(() => {});
          }
        }
      } catch {}
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // compute initial state for short pages

    // Delegated CTA click tracking (fallback): track anchors with data-cta
    const onClick = (e: MouseEvent) => {
      try {
        const target = e.target as Element | null;
        // use closest to support nested elements inside the anchor
        const anchor = target && "closest" in target ? (target.closest('a[data-cta]') as HTMLAnchorElement | null) : null;
        if (!anchor) return;
        // Skip if already handled by CtaLink to prevent duplicates
        if (anchor.getAttribute('data-cta-handled') === 'true') return;

        const source = anchor.getAttribute('data-cta') || 'cta';
        const id = buildEventId(
          typeof window !== 'undefined' ? window.location.pathname : '',
          source,
          'click'
        );
        const attrs = getAttribution();
        const title = (anchor.textContent || '').trim() || id;
        fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'cta_click', id, title, href: anchor.href, ...attrs }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };

    // capture phase to catch early before navigation
    document.addEventListener('click', onClick, true);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener('click', onClick, true);
    };
  }, [qualifier]);

  return null;
}
