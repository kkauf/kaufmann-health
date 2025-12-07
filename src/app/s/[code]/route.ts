import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { track } from '@/lib/logger';

export const runtime = 'nodejs';

type Params = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Params) {
  const { code } = await params;
  
  if (!code || code.length > 10) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Look up the short link
  const { data: link, error } = await supabaseServer
    .from('short_links')
    .select('id, target_url, utm_source, utm_medium, utm_campaign, patient_id')
    .eq('code', code.toLowerCase())
    .single();

  if (error || !link) {
    // Fallback to home if not found
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Track the click (fire and forget)
  void supabaseServer
    .from('short_links')
    .update({ 
      clicks: (link as { clicks?: number }).clicks ? (link as { clicks?: number }).clicks! + 1 : 1,
      last_clicked_at: new Date().toISOString() 
    })
    .eq('id', link.id);

  // Track as event for analytics
  void track({
    type: 'short_link_clicked',
    level: 'info',
    source: 'app.s.redirect',
    props: {
      code,
      utm_source: link.utm_source,
      utm_medium: link.utm_medium,
      utm_campaign: link.utm_campaign,
      patient_id: link.patient_id,
    },
  });

  // Build redirect URL with UTM params if not already in target
  let targetUrl = link.target_url;
  try {
    const url = new URL(targetUrl);
    // Add UTM params if they exist and aren't already in the URL
    if (link.utm_source && !url.searchParams.has('utm_source')) {
      url.searchParams.set('utm_source', link.utm_source);
    }
    if (link.utm_medium && !url.searchParams.has('utm_medium')) {
      url.searchParams.set('utm_medium', link.utm_medium);
    }
    if (link.utm_campaign && !url.searchParams.has('utm_campaign')) {
      url.searchParams.set('utm_campaign', link.utm_campaign);
    }
    targetUrl = url.toString();
  } catch {
    // If URL parsing fails, just use the target as-is
  }

  return NextResponse.redirect(targetUrl, { status: 302 });
}
