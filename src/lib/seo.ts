import type { Metadata } from 'next';

export function buildLandingMetadata({
  baseUrl,
  path,
  title,
  description,
  searchParams,
  openGraph,
  twitter,
}: {
  baseUrl: string;
  path: string;
  title: string;
  description: string;
  searchParams?: Record<string, string | undefined>;
  openGraph?: Partial<NonNullable<Metadata['openGraph']>>;
  twitter?: Partial<NonNullable<Metadata['twitter']>>;
}): Metadata {
  const canonical = `${trimSlash(baseUrl)}${ensureLeadingSlash(path)}`;
  const variant = (searchParams?.v || '').toUpperCase();
  const isTestVariant = variant === 'B' || variant === 'C';

  return {
    title,
    description,
    alternates: { canonical },
    robots: isTestVariant ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: openGraph?.images,
      ...openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: twitter?.images as string[] | undefined,
      ...twitter,
    },
  };
}

export function buildFaqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } as const;
}

export function buildLocalBusinessJsonLd({ baseUrl, path, areaServed }: {
  baseUrl: string;
  path: string;
  areaServed: { type: 'City' | 'Country'; name: string; addressLocality?: string; addressCountry?: string };
}) {
  const canonical = `${trimSlash(baseUrl)}${ensureLeadingSlash(path)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Kaufmann Health',
    url: canonical,
    image: `${trimSlash(baseUrl)}/images/color-patterns.png`,
    description: 'Kaufmann Health – Körperorientierte Begleitung',
    areaServed: {
      '@type': areaServed.type,
      name: areaServed.name,
      address: areaServed.addressLocality || areaServed.addressCountry ? {
        '@type': 'PostalAddress',
        addressLocality: areaServed.addressLocality,
        addressCountry: areaServed.addressCountry,
      } : undefined,
    },
    sameAs: ['https://www.kaufmann-health.de'],
  } as const;
}

function trimSlash(s: string) {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function ensureLeadingSlash(s: string) {
  return s.startsWith('/') ? s : `/${s}`;
}
