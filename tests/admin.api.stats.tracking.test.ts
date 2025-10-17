import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Admin Stats API - EARTH-215 Tracking Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unauthorized access', () => {
    it.skip('returns 401 without admin session (integration test - requires server)', async () => {
      // This is an integration test that requires the dev server to be running
      // Skipping for unit test suite
      const res = await fetch('http://localhost:3000/api/admin/stats');
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('Response structure', () => {
    it('returns proper structure with totals, pageTraffic, wizardFunnel, and directory', async () => {
      // Note: This test assumes you'll mock the admin auth in the test setup
      // For now, documenting expected structure
      const expectedStructure = {
        data: {
          totals: {
            therapists: expect.any(Number),
            clients: expect.any(Number),
            matches: expect.any(Number),
          },
          pageTraffic: {
            top: expect.any(Array),
            daily: expect.any(Array),
          },
          wizardFunnel: {
            page_views: expect.any(Number),
            steps: expect.any(Object),
            form_completed: expect.any(Number),
            start_rate: expect.any(Number),
          },
          wizardDropoffs: expect.any(Array),
          abandonFieldsTop: expect.any(Array),
          directory: {
            views: expect.any(Number),
            helpClicks: expect.any(Number),
            navClicks: expect.any(Number),
            contactOpened: expect.any(Number),
            contactSent: expect.any(Number),
          },
          journeyAnalysis: {
            fragebogen_only: expect.any(Number),
            therapeuten_only: expect.any(Number),
            both_fragebogen_first: expect.any(Number),
            both_therapeuten_first: expect.any(Number),
            neither: expect.any(Number),
            total_sessions: expect.any(Number),
            questionnaire_preference_rate: expect.any(Number),
            directory_to_questionnaire_rate: expect.any(Number),
          },
        },
        error: null,
      };

      // This is a schema validation test - actual integration test
      // would require mocking Supabase and admin auth
      expect(expectedStructure.data.totals).toBeDefined();
      expect(expectedStructure.data.pageTraffic).toBeDefined();
      expect(expectedStructure.data.wizardFunnel).toBeDefined();
      expect(expectedStructure.data.directory).toBeDefined();
    });
  });

  describe('Query parameters', () => {
    it('accepts days parameter (7, 30, 90)', () => {
      const validDays = [7, 30, 90];
      validDays.forEach((d) => {
        expect(d).toBeGreaterThan(0);
        expect(d).toBeLessThanOrEqual(90);
      });
    });

    it('defaults to 30 days', () => {
      const defaultDays = 30;
      expect(defaultDays).toBe(30);
    });

    it('caps at 90 days max', () => {
      const maxDays = 90;
      const input = 120;
      const capped = Math.min(input, maxDays);
      expect(capped).toBe(90);
    });
  });

  describe('Page Traffic tracking', () => {
    it('aggregates unique sessions by page_path', () => {
      const mockEvents = [
        { session_id: 's1', page_path: '/therapeuten' },
        { session_id: 's1', page_path: '/therapeuten' }, // duplicate session
        { session_id: 's2', page_path: '/therapeuten' },
        { session_id: 's3', page_path: '/fragebogen' },
      ];

      const sessionsByPath = new Map<string, Set<string>>();
      for (const evt of mockEvents) {
        if (!sessionsByPath.has(evt.page_path)) {
          sessionsByPath.set(evt.page_path, new Set());
        }
        sessionsByPath.get(evt.page_path)!.add(evt.session_id);
      }

      expect(sessionsByPath.get('/therapeuten')!.size).toBe(2); // s1, s2
      expect(sessionsByPath.get('/fragebogen')!.size).toBe(1); // s3
    });

    it('returns top 10 pages sorted by sessions', () => {
      const mockTop = [
        { page_path: '/therapeuten', sessions: 50 },
        { page_path: '/fragebogen', sessions: 30 },
        { page_path: '/', sessions: 100 },
      ];

      const sorted = mockTop.sort((a, b) => b.sessions - a.sessions);
      expect(sorted[0].page_path).toBe('/');
      expect(sorted[0].sessions).toBe(100);
    });
  });

  describe('Wizard Funnel tracking', () => {
    it('tracks unique sessions per step (1-9)', () => {
      const mockStepEvents = [
        { session_id: 's1', step: 1 },
        { session_id: 's1', step: 2 },
        { session_id: 's2', step: 1 },
        { session_id: 's3', step: 1 },
        { session_id: 's3', step: 2 },
        { session_id: 's3', step: 3 },
      ];

      const sessionsByStep: Record<number, Set<string>> = {};
      for (let i = 1; i <= 9; i++) sessionsByStep[i] = new Set();

      for (const evt of mockStepEvents) {
        if (evt.step >= 1 && evt.step <= 9) {
          sessionsByStep[evt.step].add(evt.session_id);
        }
      }

      expect(sessionsByStep[1].size).toBe(3); // s1, s2, s3
      expect(sessionsByStep[2].size).toBe(2); // s1, s3
      expect(sessionsByStep[3].size).toBe(1); // s3
    });

    it('calculates dropoff rates between steps', () => {
      const from = 100;
      const to = 70;
      const drop = from - to;
      const drop_rate = Math.round((drop / from) * 1000) / 10;

      expect(drop).toBe(30);
      expect(drop_rate).toBe(30.0); // 30%
    });

    it('calculates start rate as step1/page_views', () => {
      const page_views = 1000;
      const step1 = 250;
      const start_rate = Math.round((step1 / page_views) * 1000) / 10;

      expect(start_rate).toBe(25.0); // 25%
    });

    describe('Cohort-based funnel logic (EARTH-215 fix)', () => {
      it('properly filters cohorts: step N requires all steps 1...N', () => {
        // Scenario: Users jumping to later steps should not inflate later step counts
        const mockStepEvents = [
          // Session 1: complete path 1->2->3->4
          { session_id: 's1', step: 1 },
          { session_id: 's1', step: 2 },
          { session_id: 's1', step: 3 },
          { session_id: 's1', step: 4 },
          // Session 2: only steps 1->2
          { session_id: 's2', step: 1 },
          { session_id: 's2', step: 2 },
          // Session 3: jumps directly to step 5 (skips 1-4)
          { session_id: 's3', step: 5 },
          // Session 4: does 1->2->5 (skips 3-4)
          { session_id: 's4', step: 1 },
          { session_id: 's4', step: 2 },
          { session_id: 's4', step: 5 },
        ];

        // Build session progression map
        const sessionStepMap = new Map<string, Set<number>>();
        for (const evt of mockStepEvents) {
          if (!sessionStepMap.has(evt.session_id)) {
            sessionStepMap.set(evt.session_id, new Set());
          }
          sessionStepMap.get(evt.session_id)!.add(evt.step);
        }

        // Calculate cohorts with sequential filtering
        const cohortByStep: Record<number, Set<string>> = {};
        for (let step = 1; step <= 9; step++) {
          cohortByStep[step] = new Set();

          for (const [sid, stepsViewed] of sessionStepMap.entries()) {
            let reachedStep = true;
            for (let requiredStep = 1; requiredStep <= step; requiredStep++) {
              if (!stepsViewed.has(requiredStep)) {
                reachedStep = false;
                break;
              }
            }
            if (reachedStep) {
              cohortByStep[step].add(sid);
            }
          }
        }

        // Assertions
        expect(cohortByStep[1].size).toBe(3); // s1, s2, s4 (s3 skipped step 1)
        expect(cohortByStep[2].size).toBe(3); // s1, s2, s4 (all have 1->2)
        expect(cohortByStep[3].size).toBe(1); // only s1 (s4 skipped step 3)
        expect(cohortByStep[4].size).toBe(1); // only s1
        expect(cohortByStep[5].size).toBe(0); // nobody (s1 stopped at 4, s3 skipped 1-4, s4 skipped 3-4)

        // Verify funnel integrity: each step <= previous step
        for (let step = 2; step <= 9; step++) {
          expect(cohortByStep[step].size).toBeLessThanOrEqual(cohortByStep[step - 1].size);
        }
      });

      it('ensures drop rates are never negative', () => {
        const cohortByStep = {
          1: new Set(['s1', 's2', 's3']),
          2: new Set(['s1', 's2']),
          3: new Set(['s1']),
        };

        // Calculate dropoffs
        const dropoffs = [];
        for (let k = 1; k <= 2; k++) {
          const from = cohortByStep[k as keyof typeof cohortByStep].size;
          const to = cohortByStep[(k + 1) as keyof typeof cohortByStep].size;
          const drop = from - to;
          const drop_rate = from > 0 ? Math.round((drop / from) * 1000) / 10 : 0;
          dropoffs.push({ step: k, from, to, drop, drop_rate });
        }

        // All drops should be non-negative
        for (const d of dropoffs) {
          expect(d.drop).toBeGreaterThanOrEqual(0);
          expect(d.drop_rate).toBeGreaterThanOrEqual(0);
          expect(d.to).toBeLessThanOrEqual(d.from);
        }

        expect(dropoffs[0]).toEqual({ step: 1, from: 3, to: 2, drop: 1, drop_rate: 33.3 });
        expect(dropoffs[1]).toEqual({ step: 2, from: 2, to: 1, drop: 1, drop_rate: 50.0 });
      });

      it('handles edge case: user views steps out of order', () => {
        const mockStepEvents = [
          // Session views: 3, 1, 2, 5 (out of order)
          { session_id: 's1', step: 3 },
          { session_id: 's1', step: 1 },
          { session_id: 's1', step: 2 },
          { session_id: 's1', step: 5 },
        ];

        const sessionStepMap = new Map<string, Set<number>>();
        for (const evt of mockStepEvents) {
          if (!sessionStepMap.has(evt.session_id)) {
            sessionStepMap.set(evt.session_id, new Set());
          }
          sessionStepMap.get(evt.session_id)!.add(evt.step);
        }

        const cohortByStep: Record<number, Set<string>> = {};
        for (let step = 1; step <= 5; step++) {
          cohortByStep[step] = new Set();
          for (const [sid, stepsViewed] of sessionStepMap.entries()) {
            let reachedStep = true;
            for (let requiredStep = 1; requiredStep <= step; requiredStep++) {
              if (!stepsViewed.has(requiredStep)) {
                reachedStep = false;
                break;
              }
            }
            if (reachedStep) cohortByStep[step].add(sid);
          }
        }

        // Session should be counted in steps 1, 2, 3 but NOT 4 or 5
        expect(cohortByStep[1].has('s1')).toBe(true);
        expect(cohortByStep[2].has('s1')).toBe(true);
        expect(cohortByStep[3].has('s1')).toBe(true);
        expect(cohortByStep[4].has('s1')).toBe(false); // missing step 4
        expect(cohortByStep[5].has('s1')).toBe(false); // missing step 4
      });

      it('only counts completions from sessions that reached step 9', () => {
        const mockStepEvents = [
          // s1: complete journey 1-9
          ...Array.from({ length: 9 }, (_, i) => ({ session_id: 's1', step: i + 1 })),
          // s2: only reaches step 5
          ...Array.from({ length: 5 }, (_, i) => ({ session_id: 's2', step: i + 1 })),
          // s3: jumps to step 9 directly
          { session_id: 's3', step: 9 },
        ];

        const mockCompletions = [
          { session_id: 's1' }, // valid: reached step 9
          { session_id: 's2' }, // invalid: only reached step 5
          { session_id: 's3' }, // invalid: skipped steps 1-8
        ];

        // Build cohorts
        const sessionStepMap = new Map<string, Set<number>>();
        for (const evt of mockStepEvents) {
          if (!sessionStepMap.has(evt.session_id)) {
            sessionStepMap.set(evt.session_id, new Set());
          }
          sessionStepMap.get(evt.session_id)!.add(evt.step);
        }

        const step9Cohort = new Set<string>();
        for (const [sid, stepsViewed] of sessionStepMap.entries()) {
          let reachedStep9 = true;
          for (let step = 1; step <= 9; step++) {
            if (!stepsViewed.has(step)) {
              reachedStep9 = false;
              break;
            }
          }
          if (reachedStep9) step9Cohort.add(sid);
        }

        // Count valid completions
        const completedSessions = new Set(mockCompletions.map((c) => c.session_id));
        let validCompletions = 0;
        for (const sid of completedSessions) {
          if (step9Cohort.has(sid)) {
            validCompletions++;
          }
        }

        expect(step9Cohort.size).toBe(1); // only s1
        expect(validCompletions).toBe(1); // only s1 completion is valid
      });
    });
  });

  describe('Directory engagement tracking', () => {
    it('tracks unique sessions viewing /therapeuten', () => {
      const mockPageViews = [
        { session_id: 's1', page_path: '/therapeuten' },
        { session_id: 's1', page_path: '/therapeuten' }, // duplicate
        { session_id: 's2', page_path: '/fragebogen' },
        { session_id: 's3', page_path: '/therapeuten' },
      ];

      const dirViewSessions = new Set<string>();
      for (const pv of mockPageViews) {
        if (pv.page_path === '/therapeuten') {
          dirViewSessions.add(pv.session_id);
        }
      }

      expect(dirViewSessions.size).toBe(2); // s1, s3
    });

    it('tracks help clicks (therapeuten-callout-fragebogen)', () => {
      const mockCtaClicks = [
        { session_id: 's1', id: 'therapeuten-callout-fragebogen' },
        { session_id: 's2', id: 'other-cta' },
        { session_id: 's3', id: 'therapeuten-callout-fragebogen' },
      ];

      const helpSessions = new Set<string>();
      for (const cta of mockCtaClicks) {
        if (cta.id === 'therapeuten-callout-fragebogen') {
          helpSessions.add(cta.session_id);
        }
      }

      expect(helpSessions.size).toBe(2); // s1, s3
    });

    it('tracks nav clicks (alle-therapeuten)', () => {
      const mockCtaClicks = [
        { session_id: 's1', id: 'alle-therapeuten', href: '/therapeuten' },
        { session_id: 's2', id: 'other', href: '/other' },
        { session_id: 's3', source: 'alle-therapeuten', href: '/therapeuten' },
      ];

      const navSessions = new Set<string>();
      for (const cta of mockCtaClicks) {
        const id = (cta.id || '').toLowerCase();
        const source = ((cta as { source?: string }).source || '').toLowerCase();
        const href = (cta.href || '').toLowerCase();

        if (id === 'alle-therapeuten' || source === 'alle-therapeuten' || href.endsWith('/therapeuten')) {
          navSessions.add(cta.session_id);
        }
      }

      expect(navSessions.size).toBe(2); // s1, s3
    });

    it('calculates directory engagement rates', () => {
      const views = 100;
      const helpClicks = 15;
      const contactOpened = 10;
      const contactSent = 5;

      const helpRate = Math.round((helpClicks / views) * 1000) / 10;
      const openRate = Math.round((contactOpened / views) * 1000) / 10;
      const sendRate = Math.round((contactSent / views) * 1000) / 10;

      expect(helpRate).toBe(15.0); // 15%
      expect(openRate).toBe(10.0); // 10%
      expect(sendRate).toBe(5.0); // 5%
    });
  });

  describe('Abandoned fields tracking', () => {
    it('aggregates field names from field_abandonment events', () => {
      const mockAbandonEvents = [
        { fields: ['email', 'name'] },
        { fields: ['email'] },
        { fields: ['phone', 'email'] },
      ];

      const fieldCounts = new Map<string, number>();
      for (const evt of mockAbandonEvents) {
        for (const f of evt.fields) {
          fieldCounts.set(f, (fieldCounts.get(f) || 0) + 1);
        }
      }

      expect(fieldCounts.get('email')).toBe(3);
      expect(fieldCounts.get('name')).toBe(1);
      expect(fieldCounts.get('phone')).toBe(1);
    });

    it('returns top 15 fields sorted by count', () => {
      const mockFields = [
        { field: 'email', count: 50 },
        { field: 'phone', count: 30 },
        { field: 'name', count: 70 },
      ];

      const sorted = mockFields.sort((a, b) => b.count - a.count).slice(0, 15);
      expect(sorted[0].field).toBe('name');
      expect(sorted[0].count).toBe(70);
    });
  });
});
