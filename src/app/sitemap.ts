import type { MetadataRoute } from 'next'

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
    // Exclude /datenschutz from sitemap (but don't noindex it)
    // It's legally required to be accessible but not search-optimized
  ]
}
