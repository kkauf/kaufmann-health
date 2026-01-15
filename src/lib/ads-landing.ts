/**
 * Keyword-Echo Landing Page Copy
 * 
 * Quality Score is improved when the landing page H1 echoes the SEARCH TERM.
 * H1s are polished as proper sentences while keeping keywords visible.
 * 
 * Two approaches:
 * 1. Direct keyword pass-through via ?kw={keyword} (ValueTrack in Google Ads)
 * 2. Ad group fallback when keyword isn't passed (ad groups contain related keywords)
 * 
 * Google Ads Final URL example:
 *   https://www.kaufmann-health.de/therapie-finden?variant=concierge&kw={keyword}
 * 
 * Google replaces {keyword} with actual search term:
 *   ?kw=körpertherapie berlin → H1: "Finde deine Körpertherapie in Berlin"
 *   ?kw=narm therapie berlin → H1: "Finde deine NARM Therapie in Berlin"
 *   ?kw=nervensystem beruhigen → H1: "Lerne, dein Nervensystem zu regulieren"
 */

export type AdGroup = 'category' | 'symptoms' | 'modality';

/**
 * Known keywords → Display title mapping
 * 
 * Polished as proper sentences while keeping keywords visible for QS.
 * Based on headline performance data (Dec 2025):
 * - "Körperpsychotherapie Berlin" = top performer (~2000 impressions)
 * - "Trauma im Körper lösen" = strong (~1000 impressions)
 * - "Finde"/"finden" pattern resonates (Therapeut:innen finden ~200 imp)
 * - "Nervensystem regulieren" > "beruhigen" (700 vs 470 impressions)
 */
const keywordToTitle: Record<string, string> = {
  // Category keywords → "Finde deine [X] in Berlin" pattern
  'körpertherapie berlin': 'Finde deine Körpertherapie in Berlin',
  'körperpsychotherapie berlin': 'Finde deine Körperpsychotherapie in Berlin',
  'somatische therapie berlin': 'Starte deine somatische Therapie in Berlin',
  'körperorientierte therapie berlin': 'Körperorientierte Therapie in Berlin – ohne Warteliste',
  
  // Symptoms keywords → Keep strong performers, polish others
  'trauma körper': 'Trauma im Körper lösen', // Already a strong headline, keep as-is
  'trauma im körper lösen': 'Trauma im Körper lösen',
  'nervensystem beruhigen therapie': 'Lerne, dein Nervensystem zu regulieren',
  'nervensystem beruhigen': 'Lerne, dein Nervensystem zu regulieren',
  
  // Modality keywords → "Finde deine [X] in Berlin" pattern
  'narm therapie berlin': 'Finde deine NARM Therapie in Berlin',
  'hakomi therapie berlin': 'Finde deine Hakomi Therapie in Berlin',
  'somatic experiencing berlin': 'Starte mit Somatic Experiencing in Berlin',
  'somatic experiencing': 'Starte mit Somatic Experiencing in Berlin',
};

/**
 * Fallback titles by ad group (when keyword isn't passed directly)
 * Polished sentences that still contain keyword tokens
 */
const adGroupFallbackTitle: Record<AdGroup, string> = {
  category: 'Finde deine Körperpsychotherapie in Berlin',
  symptoms: 'Trauma im Körper lösen',
  modality: 'Finde deine Therapie: NARM, Hakomi & Somatic Experiencing',
};

/**
 * Subtitles by ad group (same regardless of variant - variant affects flow, not relevance)
 */
const adGroupSubtitle: Record<AdGroup, string> = {
  category: 'Handverlesene Körpertherapeut:innen. Online oder vor Ort. Ohne Wartezeit.',
  symptoms: 'Wenn Reden allein nicht reicht. Körperorientierte Traumatherapie in Berlin & online.',
  modality: 'Spezialist:innen für körperorientierte Verfahren. Persönlich ausgewählt.',
};

/**
 * Value props by ad group (keyword tokens visible for QS)
 */
const adGroupValueProps: Record<AdGroup, string[]> = {
  category: [
    '✓ Körperpsychotherapie Berlin',
    '✓ Handverlesene Therapeut:innen',
    '✓ Ohne Warteliste',
    '✓ Berlin & Online · 80€–120€',
  ],
  symptoms: [
    '✓ Traumasensible Begleitung',
    '✓ Nervensystem regulieren',
    '✓ Handverlesene Therapeut:innen',
    '✓ Berlin & Online · 80€–120€',
  ],
  modality: [
    '✓ NARM Therapie Berlin',
    '✓ Somatic Experiencing',
    '✓ Hakomi Therapie',
    '✓ Berlin & Online · 80€–120€',
  ],
};

export interface LandingPageCopy {
  /** H1 title - echoes the keyword for QS */
  title: string;
  /** Supporting subtitle */
  subtitle: string;
  /** Value props for the hero section */
  valueProps: string[];
}

/**
 * Parse keyword from URL (?kw= param from Google Ads ValueTrack)
 * 
 * Filters out:
 * - Empty strings
 * - Literal ValueTrack placeholders like {keyword}, {KeyWord}, etc.
 * - Malformed/unsubstituted placeholders
 */
export function parseKeyword(param: string | string[] | undefined): string | null {
  if (typeof param !== 'string' || param.length === 0) return null;
  
  // Decode and trim
  const decoded = decodeURIComponent(param).trim();
  if (decoded.length === 0) return null;
  
  // Filter out literal ValueTrack placeholders (Google Ads failed to substitute)
  // Matches: {keyword}, {KeyWord}, {KEYWORD}, {Keyword:default}, etc.
  if (/^\{.*\}$/.test(decoded) || /\{keyword/i.test(decoded)) {
    return null;
  }
  
  return decoded.toLowerCase();
}

/**
 * Parse adgroup from URL search params
 */
export function parseAdGroup(param: string | string[] | undefined): AdGroup | null {
  const raw = typeof param === 'string' ? param.toLowerCase() : null;
  if (raw === 'category' || raw === 'symptoms' || raw === 'modality') {
    return raw;
  }
  return null;
}

/**
 * Get H1 title from keyword (direct match or fuzzy)
 */
function getTitleFromKeyword(keyword: string): string | null {
  // Direct match
  if (keywordToTitle[keyword]) {
    return keywordToTitle[keyword];
  }
  
  // Fuzzy match: check if keyword contains any of our known terms
  for (const [kw, title] of Object.entries(keywordToTitle)) {
    if (keyword.includes(kw) || kw.includes(keyword)) {
      return title;
    }
  }
  
  return null;
}

/**
 * Capitalize first letter of each word for display
 */
function titleCase(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get landing page copy optimized for Quality Score
 * 
 * Priority:
 * 1. Direct keyword match (?kw=) - best for QS
 * 2. Ad group fallback (?adgroup=) - good fallback
 * 3. null - use page defaults
 */
export function getLandingPageCopy(
  keyword: string | null,
  adgroup: AdGroup | null
): LandingPageCopy | null {
  // Priority 1: Direct keyword → title
  if (keyword) {
    const title = getTitleFromKeyword(keyword);
    if (title) {
      // Infer ad group from keyword for subtitle/valueProps
      const inferredAdGroup = inferAdGroupFromKeyword(keyword);
      return {
        title,
        subtitle: inferredAdGroup ? adGroupSubtitle[inferredAdGroup] : adGroupSubtitle.category,
        valueProps: inferredAdGroup ? adGroupValueProps[inferredAdGroup] : adGroupValueProps.category,
      };
    }
    
    // Unknown keyword - title-case it as H1
    return {
      title: titleCase(keyword),
      subtitle: adgroup ? adGroupSubtitle[adgroup] : adGroupSubtitle.category,
      valueProps: adgroup ? adGroupValueProps[adgroup] : adGroupValueProps.category,
    };
  }
  
  // Priority 2: Ad group fallback
  if (adgroup) {
    return {
      title: adGroupFallbackTitle[adgroup],
      subtitle: adGroupSubtitle[adgroup],
      valueProps: adGroupValueProps[adgroup],
    };
  }
  
  // No keyword or adgroup - use page defaults
  return null;
}

/**
 * Infer ad group from keyword for subtitle/valueProps
 */
function inferAdGroupFromKeyword(keyword: string): AdGroup | null {
  const kw = keyword.toLowerCase();
  
  // Symptoms keywords
  if (kw.includes('trauma') || kw.includes('nervensystem')) {
    return 'symptoms';
  }
  
  // Modality keywords
  if (kw.includes('narm') || kw.includes('hakomi') || kw.includes('somatic experiencing')) {
    return 'modality';
  }
  
  // Category keywords (default for körper* terms)
  if (kw.includes('körper') || kw.includes('somatisch')) {
    return 'category';
  }
  
  return null;
}

// Legacy exports for backward compatibility
export function getAdGroupCopy(
  adgroup: AdGroup | null,
  _variant: 'concierge' | 'self-service'
): LandingPageCopy | null {
  return getLandingPageCopy(null, adgroup);
}
