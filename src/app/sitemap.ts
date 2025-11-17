import type { MetadataRoute } from 'next'
import { getAllModalitySlugs } from '@/features/therapies/modalityConfig'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.kaufmann-health.de'
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/wieder-lebendig`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/therapie-finden`,
      lastModified: new Date(),
      changeFrequency: 'weekly', 
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ankommen-in-dir`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/vermittlung`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/therapie`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...getAllModalitySlugs().map<MetadataRoute.Sitemap[number]>((slug) => ({
      url: `${baseUrl}/therapie/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    {
      url: `${baseUrl}/fuer-therapeuten`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/ueber-uns`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/beratung`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/impressum`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/agb`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/therapist-terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    // Exclude /datenschutz from sitemap (but don't noindex it)
    // It's legally required to be accessible but not search-optimized
    // Also intentionally excluded:
    // - /admin/* (protected area)
    // - /confirm (noindex confirmation state page)
    // - /preferences (post-confirmation flow)
    // - /match/* and /auswahl-bestaetigt (transactional flow pages)
    // - /therapists/* (onboarding flows)
  ]
}
