import { NextResponse } from 'next/server';
import { submitToIndexNow, buildIndexNowUrls } from '@/lib/indexnow';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * POST /api/internal/indexnow
 * 
 * Submits all indexed URLs to IndexNow for instant search engine indexing.
 * Call this endpoint after deployments via Vercel Deploy Hook.
 * 
 * Supports Bing, DuckDuckGo, Yandex, and AI search engines (ChatGPT, Perplexity).
 * 
 * Authorization: Requires CRON_SECRET header for security.
 */
export async function POST(req: Request) {
  // Verify authorization
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = 'https://www.kaufmann-health.de';

  try {
    // Get static URLs
    const urls = buildIndexNowUrls();

    // Add dynamic therapist profile URLs
    const { data: therapists } = await supabaseServer
      .from('therapists')
      .select('slug')
      .eq('status', 'verified')
      .not('slug', 'is', null);

    if (therapists) {
      for (const t of therapists) {
        if (t.slug) {
          urls.push(`${baseUrl}/therapeuten/${t.slug}`);
        }
      }
    }

    // Submit to IndexNow
    const result = await submitToIndexNow(urls);

    return NextResponse.json({
      success: result.success,
      submitted: result.submitted,
      totalUrls: urls.length,
      error: result.error,
    });
  } catch (err) {
    console.error('[IndexNow API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to submit URLs' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/internal/indexnow
 * 
 * Returns the list of URLs that would be submitted (for debugging).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = 'https://www.kaufmann-health.de';
  const urls = buildIndexNowUrls();

  // Add dynamic therapist profile URLs
  const { data: therapists } = await supabaseServer
    .from('therapists')
    .select('slug')
    .eq('status', 'verified')
    .not('slug', 'is', null);

  if (therapists) {
    for (const t of therapists) {
      if (t.slug) {
        urls.push(`${baseUrl}/therapeuten/${t.slug}`);
      }
    }
  }

  return NextResponse.json({ urls, count: urls.length });
}
