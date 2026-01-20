const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITE_HOST = 'www.kaufmann-health.de';

interface IndexNowResult {
  success: boolean;
  submitted: number;
  error?: string;
}

/**
 * Submit URLs to IndexNow for instant indexing by Bing, DuckDuckGo, Yandex,
 * and AI search engines like ChatGPT and Perplexity.
 * 
 * @see https://www.indexnow.org/documentation
 */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  const apiKey = process.env.INDEXNOW_API_KEY;
  
  if (!apiKey) {
    console.warn('[IndexNow] INDEXNOW_API_KEY not set, skipping submission');
    return { success: false, submitted: 0, error: 'API key not configured' };
  }

  if (urls.length === 0) {
    return { success: true, submitted: 0 };
  }

  // IndexNow accepts up to 10,000 URLs per request
  const urlList = urls.slice(0, 10000);

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        host: SITE_HOST,
        key: apiKey,
        keyLocation: `https://${SITE_HOST}/${apiKey}.txt`,
        urlList,
      }),
    });

    // IndexNow returns various success codes
    // 200: OK, URLs submitted
    // 202: Accepted, URLs will be processed later
    // 400: Bad request (invalid format)
    // 403: Key not valid
    // 422: URLs don't belong to host
    // 429: Too many requests
    if (response.ok || response.status === 202) {
      console.log(`[IndexNow] Submitted ${urlList.length} URLs successfully`);
      return { success: true, submitted: urlList.length };
    }

    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`[IndexNow] Submission failed: ${response.status} - ${errorText}`);
    return { 
      success: false, 
      submitted: 0, 
      error: `HTTP ${response.status}: ${errorText}` 
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[IndexNow] Submission error:', message);
    return { success: false, submitted: 0, error: message };
  }
}

/**
 * Build the list of URLs to submit based on sitemap content.
 * Call this after deployment to notify search engines of all indexed pages.
 */
export function buildIndexNowUrls(): string[] {
  const baseUrl = `https://${SITE_HOST}`;
  
  // Static high-priority pages
  const staticPages = [
    '',
    '/start',
    '/therapie',
    '/therapie/narm',
    '/therapie/somatic-experiencing',
    '/therapie/hakomi',
    '/therapie/core-energetics',
    '/therapeuten',
    '/fuer-therapeuten',
    '/ueber-uns',
    '/beratung',
    '/vermittlung',
    '/wieder-lebendig',
  ];

  return staticPages.map(path => `${baseUrl}${path}`);
}
