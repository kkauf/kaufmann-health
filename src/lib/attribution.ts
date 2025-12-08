/*
  Lightweight client-side attribution helpers (no cookies).
  - Stores session_id in sessionStorage
  - Captures UTM params from the URL for the current session
  - Returns a small payload to include in /api/events requests
*/

export type Attribution = {
  session_id?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  gclid?: string;
};

const SID_KEY = 'kh.sid';
const UTM_KEY = 'kh.utm';
const GCLID_KEY = 'kh.gclid';

function safeGetStorage(type: 'session' | 'local'): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return type === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function randomId(): string {
  try {
    // modern browsers
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as Crypto & { randomUUID?: () => string }).randomUUID!()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getOrCreateSessionId(): string | undefined {
  const ss = safeGetStorage('session');
  // Also try local storage for session ID persistence
  const ls = safeGetStorage('local');

  if (!ss && !ls) return undefined;

  let sid = ss?.getItem(SID_KEY) || ls?.getItem(SID_KEY) || undefined;

  if (!sid) {
    sid = randomId();
    try {
      ss?.setItem(SID_KEY, sid);
      ls?.setItem(SID_KEY, sid);
    } catch { }
  } else {
    // Sync if missing in one
    if (!ss?.getItem(SID_KEY)) ss?.setItem(SID_KEY, sid);
    if (!ls?.getItem(SID_KEY)) ls?.setItem(SID_KEY, sid);
  }
  return sid;
}

function parseUtmFromUrl(): Omit<Attribution, 'session_id' | 'referrer'> {
  try {
    if (typeof window === 'undefined') return {};
    const sp = new URLSearchParams(window.location.search);
    const utm_source = sp.get('utm_source') || undefined;
    const utm_medium = sp.get('utm_medium') || undefined;
    const utm_campaign = sp.get('utm_campaign') || undefined;
    const gclid = sp.get('gclid') || undefined;
    return { utm_source, utm_medium, utm_campaign, gclid };
  } catch {
    return {};
  }
}

function getStoredUtm(): Omit<Attribution, 'session_id' | 'referrer'> {
  const ss = safeGetStorage('session');
  const ls = safeGetStorage('local');
  if (!ss && !ls) return {};

  try {
    const raw = ss?.getItem(UTM_KEY) || ls?.getItem(UTM_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return {
      utm_source: typeof obj.utm_source === 'string' ? obj.utm_source : undefined,
      utm_medium: typeof obj.utm_medium === 'string' ? obj.utm_medium : undefined,
      utm_campaign: typeof obj.utm_campaign === 'string' ? obj.utm_campaign : undefined,
    };
  } catch {
    return {};
  }
}

function getStoredGclid(): string | undefined {
  const ss = safeGetStorage('session');
  const ls = safeGetStorage('local');
  try {
    return ss?.getItem(GCLID_KEY) || ls?.getItem(GCLID_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function storeGclid(gclid: string) {
  const ss = safeGetStorage('session');
  const ls = safeGetStorage('local');
  try {
    ss?.setItem(GCLID_KEY, gclid);
    ls?.setItem(GCLID_KEY, gclid);
  } catch { }
}

function storeUtm(utm: Omit<Attribution, 'session_id' | 'referrer'>) {
  const ss = safeGetStorage('session');
  const ls = safeGetStorage('local');
  try {
    const val = JSON.stringify(utm);
    ss?.setItem(UTM_KEY, val);
    ls?.setItem(UTM_KEY, val);
  } catch { }
}

export function getAttribution(): Attribution {
  try {
    const session_id = getOrCreateSessionId();
    const referrer = typeof document !== 'undefined' && typeof document.referrer === 'string' && document.referrer
      ? document.referrer
      : undefined;

    // Prefer stored UTM, but capture from URL on first event
    const stored = getStoredUtm();
    const fromUrl = parseUtmFromUrl();
    const utm = {
      utm_source: stored.utm_source || fromUrl.utm_source,
      utm_medium: stored.utm_medium || fromUrl.utm_medium,
      utm_campaign: stored.utm_campaign || fromUrl.utm_campaign,
    };
    if ((!stored.utm_source && utm.utm_source) || (!stored.utm_medium && utm.utm_medium) || (!stored.utm_campaign && utm.utm_campaign)) {
      storeUtm(utm);
    }

    // Capture gclid from URL or sessionStorage (critical for Google Ads attribution)
    const storedGclid = getStoredGclid();
    const gclid = storedGclid || fromUrl.gclid;
    if (!storedGclid && fromUrl.gclid) {
      storeGclid(fromUrl.gclid);
    }

    return { session_id, referrer, ...utm, gclid };
  } catch {
    return {};
  }
}

/** Get stored gclid (for passing to APIs) */
export function getGclid(): string | undefined {
  try {
    const stored = getStoredGclid();
    if (stored) return stored;
    // Also check URL in case not yet stored
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const fromUrl = sp.get('gclid') || undefined;
      if (fromUrl) storeGclid(fromUrl);
      return fromUrl;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
