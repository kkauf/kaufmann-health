# Campaign Schedule (Week 38)

Operational reference for Week 38 campaigns. Keep this concise and actionable. Update for future weeks by copying this file and adjusting dates/budgets/goals or generalize to a weekly template.

## Summary

- Campaigns
  - CONSCIOUS WELLNESS SEEKERS – Week 38
  - DEPTH SEEKERS – Week 38
- Run Window
  - Wellness: 2025-09-18 → 2025-09-22
  - Depth:    2025-09-20 → 2025-09-21
- Daily Budgets
  - Wellness: €200/day
  - Depth:    €100/day

## Goals

- Primary: Generate qualified Klient:in leads at sustainable costs
- Guardrails (from operations rules)
  - Pause if spend ≥ €30 with 0 conversions
  - Pause if spend > 2× daily budget with 0 conversions
  - Warn (report-only) if CPA > €40
  - Scale signal when CPL < €30 with 3+ leads

## Daily Checklist

- 09:00
  - Run: `npm run ads:monitor`
  - Review paused candidates and rationale
  - Adjust bids only if clearly justified
- 13:00
  - Run: `npm run ads:monitor`
  - Review search terms; add negatives if needed
- 17:00
  - Run: `npm run ads:monitor`
  - Summarize notable findings in Battle Plan

## Implementation Source of Truth

- Config: `google_ads_api_scripts/campaign-config.ts`
  - Names, dates, budgets, keywords/negatives, headlines, descriptions
- Creation Script: `google_ads_api_scripts/create-week38-campaigns.ts`
  - Idempotent by campaign name; starts campaigns PAUSED; Search-only; DE language; DE geo; sitelinks (Preise/FAQ); two RSA variants (A/B)
- Monitoring Script: `google_ads_api_scripts/monitor-campaigns.ts`
  - ENABLED SEARCH campaigns only; dry-run by default; `--apply` to pause

## Notes

- Privacy: No tracking cookies. Enhanced Conversions run server-side only after patient email confirmation.
- Safety: Start with dry runs; scope via `--nameLike="Week 38"` when applying changes.
