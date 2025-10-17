# Events Table Growth Analysis

**Analysis Date:** October 17, 2025  
**Current Size:** 8,201 events (4.3 MB)  
**Growth Rate:** 164 events/day average (50 days of data)  
**Projected Annual:** ~60K events (~312 MB)

---

## 🔴 Critical Finding: Cron Events Consuming 36% of Table

### The Problem
**Cron events (`cron_executed` + `cron_completed`) account for 2,982 events (36.37% of total)** with minimal business value after execution:

| Event Type | Count | % of Total | Avg/Day | Uniqueness | Business Value |
|-----------|-------|------------|---------|------------|----------------|
| `cron_executed` | 1,703 | 20.77% | 47.3 | 6.15% | ⚠️ Low (monitoring only) |
| `cron_completed` | 1,279 | 15.60% | 35.5 | 39.83% | ⚠️ Low (monitoring only) |
| `patient_unresponsive` | 250 | 3.05% | 8.1 | 4.72% | ⚠️ Low (cron artifact) |

**Total noise:** ~3,200 events (39% of table)

### Why This Matters
1. **Query Performance:** Admin dashboard queries scan 3,200+ irrelevant rows (59ms mean time)
2. **Storage Growth:** Cron events will reach 20K/year (~35% of annual events)
3. **Index Bloat:** All indexes on `events` table grow unnecessarily

---

## 📊 High-Value Events (Keep Forever)

These drive business decisions and should **never** be auto-archived:

| Event Type | Count | % | Business Impact |
|-----------|-------|---|-----------------|
| `page_view` | 713 | 8.69% | Funnel analysis, conversion tracking |
| `scroll_depth` | 857 | 10.45% | Engagement metrics |
| `screen_viewed` | 422 | 5.15% | Wizard funnel analysis |
| `screen_completed` | 262 | 3.19% | Completion rates |
| `email_sent` | 352 | 4.29% | Email deliverability tracking |
| `match_link_view` | 33 | 0.40% | Match conversion tracking |
| `cta_click` | 107 | 1.30% | CTA effectiveness |
| `error` | 111 | 1.35% | Debug & reliability monitoring |

**Total high-value:** ~2,857 events (34.8% of table)

---

## 💡 Recommendations

### Immediate: TTL Policy for Cron Events
```sql
-- Delete cron monitoring events older than 7 days
-- Keep recent ones for operational debugging
DELETE FROM events
WHERE type IN ('cron_executed', 'cron_completed', 'patient_unresponsive')
  AND created_at < NOW() - INTERVAL '7 days';

-- Create a weekly cleanup job
CREATE OR REPLACE FUNCTION cleanup_cron_events()
RETURNS void AS $$
BEGIN
  DELETE FROM events
  WHERE type IN ('cron_executed', 'cron_completed', 'patient_unresponsive')
    AND created_at < NOW() - INTERVAL '7 days';
  
  RAISE NOTICE 'Cleaned up old cron events';
END;
$$ LANGUAGE plpgsql;
```

**Impact:** Reduces table by ~3,000 rows immediately, prevents 60 events/day accumulation

---

### Medium-Term: Event Partitioning Strategy

**Option 1: Time-Based Partitioning** (Recommended)
```sql
-- Partition by month for efficient archival
CREATE TABLE events_2025_10 PARTITION OF events
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- Auto-archive partitions older than 90 days
-- Keep high-value events, drop cron noise
```

**Option 2: Type-Based Partitioning**
```sql
-- Separate hot (business) vs cold (monitoring) events
CREATE TABLE events_business PARTITION OF events
  FOR VALUES IN ('page_view', 'screen_viewed', 'email_sent', 'match_link_view', ...);

CREATE TABLE events_monitoring PARTITION OF events
  FOR VALUES IN ('cron_executed', 'cron_completed', 'patient_unresponsive');
```

---

### Long-Term: Archive to Cold Storage

After 6 months, move events to cheaper storage:

```sql
-- Archive to separate table (cold storage)
CREATE TABLE events_archive (
  LIKE events INCLUDING ALL
);

-- Monthly job: Move events older than 6 months
INSERT INTO events_archive
SELECT * FROM events
WHERE created_at < NOW() - INTERVAL '6 months'
  AND type NOT IN ('cron_executed', 'cron_completed', 'patient_unresponsive');

DELETE FROM events
WHERE created_at < NOW() - INTERVAL '6 months';
```

**Savings:** Keeps hot table under 30K rows (~15 MB), improves all query performance

---

## 🎯 Quick Wins (This Sprint)

### 1. One-Time Cleanup (Safe to Run Now)
```sql
-- Removes 90% of cron noise (keeps last 7 days for debugging)
DELETE FROM events
WHERE type IN ('cron_executed', 'cron_completed', 'patient_unresponsive')
  AND created_at < NOW() - INTERVAL '7 days';

-- Expected removal: ~2,800 events
-- New table size: ~5,400 events (2.4 MB)
```

### 2. Stop Logging Low-Value Cron Events

**Adjust ServerAnalytics to skip noisy cron events:**

```typescript
// In src/lib/server-analytics.ts
export class ServerAnalytics {
  static async trackEventFromRequest(req: Request, event: EventPayload) {
    // Skip noisy cron monitoring events
    if (['cron_executed', 'cron_completed'].includes(event.type)) {
      if (process.env.NODE_ENV === 'production') {
        // Only log failures in production
        if (!event.props?.error) return;
      }
    }
    // ... rest of logging
  }
}
```

**Impact:** Reduces future growth by 80 events/day (~29K/year)

### 3. Add Composite Index for Admin Stats
```sql
-- Speeds up admin dashboard queries filtering by type + date
CREATE INDEX idx_events_type_created_desc 
ON events(type, created_at DESC);

-- Replaces sequential scans with index-only scans
-- Expected improvement: 59ms → 5ms for admin stats queries
```

---

## 📈 Growth Projections

### Current Trajectory (No Changes)
- **1 year:** 60K events (~312 MB)
- **2 years:** 120K events (~624 MB)
- **Query performance:** Degrades linearly with table size

### With Recommended Changes
- **Steady state:** ~5-10K events (hot data < 30 days)
- **Annual archived:** ~35K events (cold storage)
- **Query performance:** Stays constant (small working set)

---

## 🔍 Event Quality Audit

### High Duplication (Consider Sampling)

| Event Type | Uniqueness | Recommendation |
|-----------|------------|----------------|
| `cron_executed` | 6.15% | ✅ Delete old, log failures only |
| `patient_unresponsive` | 4.72% | ✅ Delete old (cron artifact) |
| `field_change` | 19.02% | ⚠️ Consider sampling (every 10th) |
| `form_session_saved` | 37.66% | ⚠️ Consider throttling (30s debounce) |

### Well-Balanced Events (Keep All)
- `screen_completed`: 100% unique
- `section_view`: 93.11% unique
- `cta_click`: 81.52% unique
- `error`: 67.80% unique

---

## 🚀 Implementation Plan

### Week 1: Immediate Cleanup
1. ✅ Run one-time DELETE query (removes 2,800 cron events)
2. ✅ Add composite index for admin stats queries
3. ✅ Deploy ServerAnalytics change to stop logging noisy cron events

### Week 2: Monitoring
1. Monitor new event growth rate (should drop to ~80/day)
2. Verify admin dashboard query performance improvement
3. Document new retention policy in `/docs/analytics.md`

### Month 2: Automation
1. Create weekly cleanup cron job (7-day TTL for monitoring events)
2. Add alerting if events table exceeds 10K rows
3. Consider implementing time-based partitioning

---

## 🔧 Migration Script

```sql
-- Run during low-traffic window (takes ~100ms with 8K rows)

-- 1. One-time cleanup
DELETE FROM events
WHERE type IN ('cron_executed', 'cron_completed', 'patient_unresponsive')
  AND created_at < NOW() - INTERVAL '7 days';

-- 2. Add composite index for admin dashboard
CREATE INDEX CONCURRENTLY idx_events_type_created_desc 
ON events(type, created_at DESC);

-- 3. Verify cleanup
SELECT 
  COUNT(*) as remaining_events,
  pg_size_pretty(pg_total_relation_size('events')) as new_size
FROM events;

-- Expected: ~5,400 events, ~2.4 MB
```

---

## 📝 Summary

**Current waste:** 36% of events table is low-value cron monitoring  
**Quick fix:** Delete old cron events + stop logging in production  
**Result:** 80% reduction in growth rate, faster admin queries  
**Long-term:** Implement partitioning + archival strategy  

**No user-facing impact** — all changes are internal observability improvements.
