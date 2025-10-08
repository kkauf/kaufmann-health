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

  // Default to hero.jpg if no images specified
  const defaultOgImage = [{ url: `${trimSlash(baseUrl)}/images/hero.jpg`, width: 1200, height: 630 }];
  const ogImages = openGraph?.images || defaultOgImage;

  // Extract twitter image from OG images
  let twitterImages: string[] = [];
  if (twitter?.images) {
    twitterImages = twitter.images as string[];
  } else if (Array.isArray(ogImages) && ogImages.length > 0) {
    const firstImage = ogImages[0];
    if (typeof firstImage === 'string') {
      twitterImages = [firstImage];
    } else if (firstImage && typeof firstImage === 'object' && 'url' in firstImage) {
      const url = firstImage.url;
      twitterImages = [typeof url === 'string' ? url : url.toString()];
    }
  }

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
      siteName: 'Kaufmann Health',
      locale: 'de_DE',
      images: ogImages,
      ...openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: twitterImages,
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
    image: `${trimSlash(baseUrl)}/images/hero.jpg`,
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
