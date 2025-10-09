import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServerAnalytics } from '@/lib/server-analytics';

describe('Test #0: Positioning A/B Attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseCampaignFromRequest', () => {
    it('should parse variant=body-oriented as A from /start', () => {
      const req = new Request('https://api.example.com/api/public/leads', {
        headers: {
          referer: 'https://www.kaufmann-health.de/start?variant=body-oriented',
        },
      });

      const { campaign_source, campaign_variant } = ServerAnalytics.parseCampaignFromRequest(req);

      expect(campaign_source).toBe('/start');
      expect(campaign_variant).toBe('A');
    });

    it('should parse variant=ready-now as B from /start', () => {
      const req = new Request('https://api.example.com/api/public/leads', {
        headers: {
          referer: 'https://www.kaufmann-health.de/start?variant=ready-now',
        },
      });

      const { campaign_source, campaign_variant } = ServerAnalytics.parseCampaignFromRequest(req);

      expect(campaign_source).toBe('/start');
      expect(campaign_variant).toBe('B');
    });

    it('should default to variant A when no variant param on /start', () => {
      const req = new Request('https://api.example.com/api/public/leads', {
        headers: {
          referer: 'https://www.kaufmann-health.de/start',
        },
      });

      const { campaign_source, campaign_variant } = ServerAnalytics.parseCampaignFromRequest(req);

      expect(campaign_source).toBe('/start');
      expect(campaign_variant).toBe('A');
    });

    it('should be case-insensitive for variant param', () => {
      const req = new Request('https://api.example.com/api/public/leads', {
        headers: {
          referer: 'https://www.kaufmann-health.de/start?variant=READY-NOW',
        },
      });

      const { campaign_source, campaign_variant } = ServerAnalytics.parseCampaignFromRequest(req);

      expect(campaign_variant).toBe('B');
    });

    it('should handle variant=Body-Oriented (mixed case)', () => {
      const req = new Request('https://api.example.com/api/public/leads', {
        headers: {
          referer: 'https://www.kaufmann-health.de/start?variant=Body-Oriented',
        },
      });

      const { campaign_source, campaign_variant } = ServerAnalytics.parseCampaignFromRequest(req);

      expect(campaign_variant).toBe('A');
    });

    it('should ignore variant param on non-/start pages', () => {
      const req = new Request('https://api.example.com/api/public/leads', {
        headers: {
          referer: 'https://www.kaufmann-health.de/therapie-finden?variant=ready-now',
        },
      });

      const { campaign_source, campaign_variant } = ServerAnalytics.parseCampaignFromRequest(req);

      expect(campaign_source).toBe('/therapie-finden');
      expect(campaign_variant).toBe('A'); // variant param ignored, default A
    });

    it('should parse /ankommen-in-dir without variant support', () => {
      const req = new Request('https://api.example.com/api/public/leads', {
        headers: {
          referer: 'https://www.kaufmann-health.de/ankommen-in-dir',
        },
      });

      const { campaign_source, campaign_variant } = ServerAnalytics.parseCampaignFromRequest(req);

      expect(campaign_source).toBe('/ankommen-in-dir');
      expect(campaign_variant).toBe('A');
    });

    it('should parse /wieder-lebendig without variant support', () => {
      const req = new Request('https://api.example.com/api/public/leads', {
        headers: {
          referer: 'https://www.kaufmann-health.de/wieder-lebendig',
        },
      });

      const { campaign_source, campaign_variant } = ServerAnalytics.parseCampaignFromRequest(req);

      expect(campaign_source).toBe('/wieder-lebendig');
      expect(campaign_variant).toBe('A');
    });
  });

  describe('Campaign source precedence', () => {
    it('should prioritize /start over default', () => {
      const req = new Request('https://api.example.com/api/public/leads', {
        headers: {
          referer: 'https://www.kaufmann-health.de/start?variant=body-oriented',
        },
      });

      const { campaign_source } = ServerAnalytics.parseCampaignFromRequest(req);

      expect(campaign_source).toBe('/start');
    });

    it('should fall back to /therapie-finden when no matching path', () => {
      const req = new Request('https://api.example.com/api/public/leads', {
        headers: {
          referer: 'https://www.kaufmann-health.de/some-other-page',
        },
      });

      const { campaign_source } = ServerAnalytics.parseCampaignFromRequest(req);

      expect(campaign_source).toBe('/therapie-finden');
    });
  });
});
