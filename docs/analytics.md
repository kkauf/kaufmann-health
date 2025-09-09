# Analytics & Tracking System

## Architecture Overview

**Dual Analytics Strategy:**
- **Vercel Analytics**: High-level funnel conversion rates, page performance (cookieless)
- **Supabase Events**: Granular business logic, user behavior, error tracking

**Key Principle**: No duplication - each system serves different analytical needs.

## Supabase Events System

### Database Schema
```sql
-- public.events table (unified logging)
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error')),
  type text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  hashed_ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Implementation Patterns

**Server-side tracking (API routes):**
```typescript
import { ServerAnalytics } from '@/lib/server-analytics';

// In API routes
await ServerAnalytics.trackEventFromRequest(req, {
  type: 'lead_submitted',
  source: 'api.leads', 
  props: { lead_type: 'patient', city: city || null }
});
```

**Client-side tracking (components):**
```typescript
// Use navigator.sendBeacon for reliability
const trackEvent = (type: string, props = {}) => {
  const payload = { type, ...props };
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/events', JSON.stringify(payload));
  } else {
    fetch('/api/events', { 
      method: 'POST', 
      body: JSON.stringify(payload),
      keepalive: true 
    });
  }
};

// Usage in components
trackEvent('cta_click', { 
  eventId: 'fuer-therapeuten-hero-apply',
  location: 'hero'
});
```

### Event Type Standards

**Business Events:**
- `lead_submitted` - Form submissions (patient/therapist)
- `therapist_responded` - Match responses
- `match_created` - Manual matches by admin
- `cta_click` - Call-to-action interactions
- `form_submit` - Form completions
- `faq_open` - FAQ expansions

**System Events:**
- `error` - Application errors
- `email_sent` - Email delivery tracking
- `payment_completed` - Transaction events

**Event ID Naming Convention:**
`{page}-{location}-{action}[-{qualifier}]`

Examples:
- `fuer-therapeuten-hero-apply`
- `fuer-therapeuten-cta-apply`
- `fuer-therapeuten-faq-fee`

### Privacy & Compliance
- All IPs hashed with `IP_HASH_SALT`
- No PII in event properties
- GDPR-compliant by design

## Vercel Analytics System

### Implementation
```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/next';

<Analytics 
  beforeSend={(event) => {
    // Redact sensitive URLs
    if (event.url.includes('/match/') || event.url.includes('/admin/')) {
      return null;
    }
    return event;
  }}
/>
```

### Custom Events (High-Level Only)
```typescript
import { track } from '@vercel/analytics';

// Major conversion points only
track('Lead Started');           // Form opened
track('Lead Submitted');         // Form completed  
track('Therapist Applied');      // Application started
track('Match Created');          // Manual match made
```

### When to Use Each System

**Use Vercel Analytics for:**
- Page view analysis
- High-level conversion funnel
- Performance monitoring
- A/B testing page variants
- Geographic insights (cookieless)

**Use Supabase Events for:**
- Business logic events
- User behavior within features
- Error tracking and debugging
- Operational monitoring
- Detailed conversion attribution

## Implementation Guidelines for New Features

### 1. Planning Phase
- Identify if feature needs tracking
- Determine if it's high-level (Vercel) or detailed (Supabase)
- Plan event naming following conventions

### 2. Implementation
- Add Supabase events for business logic
- Add Vercel events ONLY for major conversions
- Test both systems work correctly

### 3. Documentation
- Update this file with new event types
- Document any new event ID patterns
- Add to README if it affects deployment

## Common Patterns

**Form Submissions:**
```typescript
// Supabase: Detailed form tracking
await ServerAnalytics.trackEventFromRequest(req, {
  type: 'form_submit',
  source: 'api.therapist-signup',
  props: { 
    form_type: 'therapist_application',
    specializations_count: specializations.length 
  }
});

// Vercel: High-level conversion only
track('Therapist Applied');
```

**Error Handling:**
```typescript
// Always use Supabase for errors
catch (e) {
  await logError('api.leads', e, { 
    stage: 'validation', 
    form_data: safeFormData 
  }, ip, ua);
  return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
}
```

**User Actions:**
```typescript
// Client-side: Detailed interaction tracking (Supabase)
onClick={() => {
  trackEvent('cta_click', { 
    eventId: 'therapist-profile-contact',
    therapist_id: therapist.id 
  });
}}

// Major milestone reached (Vercel)
track('Match Accepted');
```

## Monitoring & Maintenance

- **Supabase**: Query events table for business insights
- **Vercel**: Use dashboard for funnel analysis
- **Regular Review**: Monthly check of event types and cleanup unused ones
- **Performance**: Events are fire-and-forget, never block user experience

## Migration Notes

When adding new tracking:
1. Follow existing patterns from this doc
2. Test in development first
3. Deploy incrementally
4. Monitor for 24h after deployment
5. Update this documentation

## Profile Completion Funnel (EARTH-73)

__Why__: Profile completion touches both documents and profile data. Tracking server-side keeps the public site cookie-free and centralizes observability in one place without duplicating high-level analytics.

__Server Events__ (Supabase):
- `therapist_documents_uploaded` — emitted by `POST /api/therapists/:id/documents`
  - props: `license: boolean`, `specialization_count: number`, `profile_photo: boolean`, `approach_text: boolean`
- `email_attempted` — emitted around upload confirmation, approval, rejection, and reminder sends
- Optional additions (if needed later): `therapist_profile_approved`, `therapist_profile_rejected`

__Vercel Analytics__:
- No additional events; keep high-level only. Existing page-level conversions are sufficient.

__Queries__: Use the `events` table to derive:
- Signup → Document upload rate
- Document upload → Approval rate
- Signup → Profile completion rate (photo + approach)
- Completion → Activation rate (approval with `photo_url`)