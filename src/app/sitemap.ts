import type { MetadataRoute } from 'next'
import { getAllModalitySlugs } from '@/features/therapies/modalityConfig'
import { supabaseServer } from '@/lib/supabase-server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.kaufmann-health.de'
  
  // Fetch verified therapists with slugs for dynamic entries
  let therapistEntries: MetadataRoute.Sitemap = [];
  try {
    const { data: therapists } = await supabaseServer
      .from('therapists')
      .select('slug, updated_at')
      .eq('status', 'verified')
      .not('slug', 'is', null);
    
    if (therapists && therapists.length > 0) {
      therapistEntries = therapists
        .filter((t): t is { slug: string; updated_at: string | null } => Boolean(t.slug))
        .map((t) => ({
          url: `${baseUrl}/therapeuten/${t.slug}`,
          lastModified: t.updated_at ? new Date(t.updated_at) : new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        }));
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch therapists:', err);
  }
  
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
      priority: 0.5,
    },
    {
      url: `${baseUrl}/therapie-finden`,
      lastModified: new Date(),
      changeFrequency: 'weekly', 
      priority: 0.9,
    },
    {
      url: `${baseUrl}/start`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ankommen-in-dir`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
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
      priority: 0.9,
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
    {
      url: `${baseUrl}/fragebogen`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/datenschutz`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    // Therapist directory page
    {
      url: `${baseUrl}/therapeuten`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    // Dynamic therapist profile pages
    ...therapistEntries,
    // Intentionally excluded from sitemap:
    // - /admin/* (protected area)
    // - /confirm (noindex confirmation state page)
    // - /match/* and /auswahl-bestaetigt (transactional flow pages)
    // - /therapists/* (onboarding flows)
  ]
}
