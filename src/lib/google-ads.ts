import { createHash } from 'crypto';
import { logError, track } from '@/lib/logger';

function normalizePhone(phone: string): string {
  return phone.replace(/\D+/g, '');
}

// Google Ads Enhanced Conversions (server-side) minimal wrapper.
// - Uses OAuth2 refresh token flow to obtain access tokens
// - Uploads hashed user identifiers and conversion attributes via ConversionUploadService
// - Falls back to no-op with internal event logging when not configured

export type ConversionData = {
  email?: string;
  phoneNumber?: string;
  conversionAction: string; // alias or full resource name
  conversionValue: number; // in major currency units (e.g., EUR)
  orderId?: string;
  conversionDateTime?: string; // ISO string; will be converted to Google format
  currency?: string; // default EUR
  gclid?: string; // Google Click ID from ad click (critical for attribution)
};

export type UserIdentifier = {
  hashed_email?: string;
  hashed_phone_number?: string;
};

export type EnhancedConversion = {
  conversion_action: string; // resource name or alias
  conversion_date_time: string; // 'YYYY-MM-DD HH:MM:SS+00:00'
  conversion_value: number; // value in major currency units
  currency: string; // e.g., 'EUR'
  order_id?: string;
  gclid?: string; // Google Click ID (primary attribution signal)
  user_identifiers: UserIdentifier[];
};

function normalizeEmail(email: string): string {
  // Normalize per Google requirements: lowercase, trim, remove spaces,
  // and for gmail/googlemail remove dots in the local-part.
  const cleaned = email.trim().toLowerCase().replace(/\s+/g, '');
  const atIdx = cleaned.indexOf('@');
  if (atIdx === -1) return cleaned;
  const local = cleaned.slice(0, atIdx);
  const domain = cleaned.slice(atIdx + 1);
  if (/^(gmail|googlemail)\.com$/.test(domain)) {
    return `${local.replace(/\./g, '')}@${domain}`;
  }
  return cleaned;
}

function sha256LowerHex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function toGoogleDateTime(iso?: string): string {
  // Google Ads expects: 'YYYY-MM-DD HH:MM:SS+|-HH:MM'
  // Convert from ISO like '2025-08-28T15:02:03.123Z' => '2025-08-28 15:02:03+00:00'
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const HH = pad(d.getUTCHours());
  const MM = pad(d.getUTCMinutes());
  const SS = pad(d.getUTCSeconds());
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}+00:00`;
}

function aliasToEnvKey(alias: string): string {
  // client_registration -> GOOGLE_ADS_CA_CLIENT_REGISTRATION
  const key = alias
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `GOOGLE_ADS_CA_${key}`;
}

export class GoogleAdsTracker {
  private clientId?: string;
  private clientSecret?: string;
  private refreshToken?: string;
  private developerToken?: string;
  private customerId?: string;
  private loginCustomerId?: string;
  private lastTokenError?: string;

  private cachedAccessToken?: { token: string; exp: number };

  constructor() {
    this.clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    this.refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    this.customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    this.loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    this.lastTokenError = undefined;
  }

  private isConfigured(): boolean {
    return !!(
      this.clientId &&
      this.clientSecret &&
      this.refreshToken &&
      this.developerToken &&
      this.customerId
    );
  }

  private missingConfig(): string[] {
    const missing: string[] = [];
    if (!this.clientId) missing.push('GOOGLE_ADS_CLIENT_ID');
    if (!this.clientSecret) missing.push('GOOGLE_ADS_CLIENT_SECRET');
    if (!this.refreshToken) missing.push('GOOGLE_ADS_REFRESH_TOKEN');
    if (!this.developerToken) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');
    if (!this.customerId) missing.push('GOOGLE_ADS_CUSTOMER_ID');
    return missing;
  }

  private resolveConversionAction(nameOrAlias: string): string | undefined {
    if (!nameOrAlias) return undefined;
    if (nameOrAlias.startsWith('customers/')) return nameOrAlias; // already a resource name
    const envKey = aliasToEnvKey(nameOrAlias);
    return process.env[envKey] || undefined;
  }

  private async getAccessToken(): Promise<string | null> {
    try {
      const now = Date.now();
      if (this.cachedAccessToken && this.cachedAccessToken.exp > now + 10_000) {
        return this.cachedAccessToken.token;
      }
      if (!this.clientId || !this.clientSecret || !this.refreshToken) return null;

      const body = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      });

      // Add short timeout + limited retries to handle transient TLS/network issues
      const maxAttempts = 3;
      const timeouts = [5000, 6000, 8000];
      const backoff = (i: number) => [100, 500, 1200][Math.min(i, 2)];

      let lastErr: unknown = undefined;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeouts[attempt] ?? 5000);
        try {
          const resp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            // Non-OK is likely non-transient (e.g., invalid_grant). Do not retry further.
            throw new Error(`oauth_token_error ${resp.status}: ${text}`);
          }
          const json = (await resp.json()) as { access_token: string; expires_in?: number };
          const exp = Date.now() + Math.max(30, (json.expires_in || 3600) - 30) * 1000;
          this.cachedAccessToken = { token: json.access_token, exp };
          this.lastTokenError = undefined;
          return json.access_token;
        } catch (err) {
          clearTimeout(timer);
          lastErr = err;
          // Retry only on network/timeout errors; for oauth_token_error, break immediately.
          const msg = (err instanceof Error ? err.message : String(err)) || '';
          if (msg.startsWith('oauth_token_error')) {
            break;
          }
          if (attempt < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, backoff(attempt)));
            continue;
          }
        }
      }
      // Final failure: log once and return null
      this.lastTokenError = (lastErr instanceof Error ? lastErr.message : String(lastErr)) || 'unknown_error';
      await logError('google_ads', lastErr, { stage: 'get_access_token' });
      return null;
    } catch (e) {
      // Unexpected failure path
      this.lastTokenError = e instanceof Error ? e.message : String(e);
      await logError('google_ads', e, { stage: 'get_access_token' });
      return null;
    }
  }

  private buildClickConversion(ec: EnhancedConversion) {
    // REST JSON for ConversionUploadService.uploadClickConversions
    return {
      conversionAction: this.resolveConversionAction(ec.conversion_action)!,
      conversionDateTime: ec.conversion_date_time,
      conversionValue: ec.conversion_value,
      currencyCode: ec.currency,
      ...(ec.order_id ? { orderId: ec.order_id } : {}),
      // gclid is the primary attribution signal from ad clicks
      ...(ec.gclid ? { gclid: ec.gclid } : {}),
      userIdentifiers: ec.user_identifiers.map((u) => ({
        ...(u.hashed_email ? { hashedEmail: u.hashed_email } : {}),
        ...(u.hashed_phone_number ? { hashedPhoneNumber: u.hashed_phone_number } : {}),
        userIdentifierSource: 'FIRST_PARTY',
      })),
    } as const;
  }

  validateConversionData(data: ConversionData): boolean {
    const hasEmail = !!(data?.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email));
    const hasPhone = !!(data?.phoneNumber && normalizePhone(data.phoneNumber).length >= 8);
    if (!hasEmail && !hasPhone) return false;
    if (!data?.conversionAction || typeof data.conversionValue !== 'number') return false;
    return true;
  }

  hashEmail(email: string): string {
    return sha256LowerHex(normalizeEmail(email));
  }

  hashPhone(phone: string): string {
    return sha256LowerHex(normalizePhone(phone));
  }

  async trackConversion(data: ConversionData): Promise<void> {
    try {
      if (!this.validateConversionData(data)) return;

      const identifiers: UserIdentifier[] = [];
      if (data.email) identifiers.push({ hashed_email: this.hashEmail(data.email) });
      if (data.phoneNumber) identifiers.push({ hashed_phone_number: this.hashPhone(data.phoneNumber) });

      const enhanced: EnhancedConversion = {
        conversion_action: data.conversionAction,
        conversion_date_time: toGoogleDateTime(data.conversionDateTime),
        conversion_value: data.conversionValue,
        currency: data.currency || 'EUR',
        order_id: data.orderId,
        gclid: data.gclid, // Pass through gclid for attribution
        user_identifiers: identifiers,
      };

      await this.uploadEnhancedConversions([enhanced]);
    } catch (e) {
      await logError('google_ads', e, { stage: 'track_conversion' });
    }
  }

  async uploadEnhancedConversions(conversions: EnhancedConversion[]): Promise<void> {
    try {
      const actions = conversions.map((c) => c.conversion_action);
      const orderIds = conversions.map((c) => c.order_id).filter(Boolean);
      // If not configured, no-op but keep an internal trace for observability
      if (!this.isConfigured()) {
        await track({
          type: 'google_ads_noop',
          source: 'google_ads',
          props: { count: conversions.length, actions, order_ids: orderIds, missing: this.missingConfig() },
          level: 'info',
        });
        return;
      }

      // Resolve all conversion action resource names; if any missing, skip upload and log
      const unresolved = conversions
        .map((c) => ({ a: c.conversion_action, r: this.resolveConversionAction(c.conversion_action) }))
        .filter((x) => !x.r);
      if (unresolved.length > 0) {
        await logError('google_ads', new Error('missing_conversion_action_mapping'), {
          missing: unresolved.map((u) => u.a),
          expected_env_keys: unresolved.map((u) => aliasToEnvKey(u.a)),
          actions,
          order_ids: orderIds,
        });
        return;
      }

      const token = await this.getAccessToken();
      if (!token) {
        await track({
          type: 'google_ads_token_unavailable',
          source: 'google_ads',
          level: 'warn',
          props: {
            count: conversions.length,
            actions,
            order_ids: orderIds,
            last_error_message: this.lastTokenError,
          },
        });
        return;
      }

      const clickConversions = conversions.map((c) => this.buildClickConversion(c));
      const url = `https://googleads.googleapis.com/v21/customers/${this.customerId}:uploadClickConversions`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'developer-token': this.developerToken!,
        'Content-Type': 'application/json',
      };
      if (this.loginCustomerId) headers['login-customer-id'] = this.loginCustomerId;

      const payload = {
        conversions: clickConversions,
        partialFailure: true,
        validateOnly: false,
      } as const;

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`upload_error ${resp.status}: ${text.slice(0, 500)}`);
      }

      // Parse response to capture partial failures and results count
      let raw: unknown = null;
      try {
        raw = await resp.json();
      } catch {}
      const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
      const getNumber = (o: unknown, key: string): number | undefined => {
        if (!isObj(o)) return undefined;
        const v = o[key];
        return typeof v === 'number' ? v : undefined;
      };
      const getObject = (o: unknown, key: string): Record<string, unknown> | undefined => {
        if (!isObj(o)) return undefined;
        const v = o[key];
        return isObj(v) ? v : undefined;
      };
      const getArray = (o: unknown, key: string): unknown[] | undefined => {
        if (!isObj(o)) return undefined;
        const v = o[key];
        return Array.isArray(v) ? v : undefined;
      };
      const results = getArray(raw, 'results');
      const received = Array.isArray(results) ? results.length : undefined;
      const partial = getObject(raw, 'partialFailureError');

      if (partial) {
        await track({
          type: 'google_ads_partial_failure',
          source: 'google_ads',
          level: 'warn',
          props: {
            actions,
            order_ids: orderIds,
            code: getNumber(partial, 'code'),
            message: (() => {
              const m = partial['message'];
              return typeof m === 'string' ? m : undefined;
            })(),
          },
        });
      }

      await track({
        type: 'google_ads_uploaded',
        source: 'google_ads',
        level: 'info',
        props: {
          count: conversions.length,
          received,
          actions,
          order_ids: orderIds,
        },
      });
    } catch (e) {
      await logError('google_ads', e, { stage: 'upload_enhanced_conversions' ,
        actions: (conversions || []).map((c) => c.conversion_action),
        order_ids: (conversions || []).map((c) => c.order_id).filter(Boolean),
        count: (conversions || []).length,
      });
    }
  }
}

export const googleAdsTracker = new GoogleAdsTracker();

// Export internals for high-ROI tests if needed
export const __internals = { normalizeEmail, sha256LowerHex, toGoogleDateTime, aliasToEnvKey };
