import { createHash } from 'crypto';
import { logError, track } from '@/lib/logger';

// Google Ads Enhanced Conversions (server-side) minimal wrapper.
// - Uses OAuth2 refresh token flow to obtain access tokens
// - Uploads hashed user identifiers and conversion attributes via UserDataService
// - Falls back to no-op with internal event logging when not configured

export type ConversionData = {
  email: string;
  conversionAction: string; // alias or full resource name
  conversionValue: number; // in major currency units (e.g., EUR)
  orderId?: string;
  conversionDateTime?: string; // ISO string; will be converted to Google format
  currency?: string; // default EUR
};

export type UserIdentifier = {
  hashed_email: string; // SHA-256 lower hex of normalized email
};

export type EnhancedConversion = {
  conversion_action: string; // resource name or alias
  conversion_date_time: string; // 'YYYY-MM-DD HH:MM:SS+00:00'
  conversion_value: number; // value in major currency units
  currency: string; // e.g., 'EUR'
  order_id?: string;
  user_identifiers: UserIdentifier[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().replace(/\s+/g, '');
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
  // patient_registration -> GOOGLE_ADS_CA_PATIENT_REGISTRATION
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

  private cachedAccessToken?: { token: string; exp: number };

  constructor() {
    this.clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    this.refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    this.customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    this.loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
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

      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`oauth_token_error ${resp.status}: ${text}`);
      }
      const json = (await resp.json()) as { access_token: string; expires_in?: number };
      const exp = Date.now() + Math.max(30, (json.expires_in || 3600) - 30) * 1000;
      this.cachedAccessToken = { token: json.access_token, exp };
      return json.access_token;
    } catch (e) {
      await logError('google_ads', e, { stage: 'get_access_token' });
      return null;
    }
  }

  private buildOperation(ec: EnhancedConversion) {
    // JSON field names use lowerCamelCase for Google Ads REST mapping
    return {
      create: {
        userIdentifiers: ec.user_identifiers.map((u) => ({ hashedEmail: u.hashed_email })),
        transactionAttribute: {
          conversionAction: this.resolveConversionAction(ec.conversion_action),
          conversionDateTime: ec.conversion_date_time,
          transactionAmountMicros: Math.round(ec.conversion_value * 1_000_000),
          currencyCode: ec.currency,
          ...(ec.order_id ? { orderId: ec.order_id } : {}),
        },
      },
    } as const;
  }

  validateConversionData(data: ConversionData): boolean {
    if (!data?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return false;
    if (!data?.conversionAction || typeof data.conversionValue !== 'number') return false;
    return true;
  }

  hashEmail(email: string): string {
    return sha256LowerHex(normalizeEmail(email));
  }

  async trackConversion(data: ConversionData): Promise<void> {
    try {
      if (!this.validateConversionData(data)) return;

      const enhanced: EnhancedConversion = {
        conversion_action: data.conversionAction,
        conversion_date_time: toGoogleDateTime(data.conversionDateTime),
        conversion_value: data.conversionValue,
        currency: data.currency || 'EUR',
        order_id: data.orderId,
        user_identifiers: [{ hashed_email: this.hashEmail(data.email) }],
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
          props: { count: conversions.length, actions, order_ids: orderIds },
        });
        return;
      }

      const operations = conversions.map((c) => this.buildOperation(c));
      const url = `https://googleads.googleapis.com/v20/customers/${this.customerId}:uploadUserData`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'developer-token': this.developerToken!,
        'Content-Type': 'application/json',
      };
      if (this.loginCustomerId) headers['login-customer-id'] = this.loginCustomerId;

      const payload = {
        operations,
        enablePartialFailure: true,
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

      // Parse response to capture partial failures and received count
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
      const received = getNumber(raw, 'receivedOperationsCount');
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
