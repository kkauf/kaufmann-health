---
trigger: always_on
---

# Kaufmann Health Quick Reference

## Development Commands

```bash
# Development
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Build for production
npm run test:critical          # Run critical tests before deploy

# Database
npx supabase db push          # Apply migrations
npx supabase db reset         # Reset database

# UI Components
npx shadcn@latest add button  # Add ShadCN component
```

## File Placement Rules
- New API route? → `/api/public` or `/api/admin` (never under /app)
- New component? → `/features/[domain]/components` or `/shared/components`
- Business logic? → `/features/[domain]/lib`
- Page? → `/app` with route groups: `/(public)`, `/(admin)`, `/(auth)`

## Active Features
/features/leads → Lead forms, verification
/features/therapists → Applications, profiles
/features/matching → Match workflow
/features/analytics → Tracking, attribution

If a file takes >3 clicks to find, move it.

## Common Patterns

### API Route Structure
```typescript
export async function POST(req: Request) {
  try {
    // Get IP for tracking
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const ua = req.headers.get('user-agent') || '';
    
    // Parse and validate
    const data = await req.json();
    
    // Process
    const result = await processData(data);
    
    // Track success
    void track({ type: 'action_completed', source: 'api.endpoint' });
    
    return NextResponse.json(result);
  } catch (e) {
    void logError('api.endpoint', e, { context }, ip, ua);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### Component Structure
```typescript
'use client';

import { useState, useCallback } from 'react';

export function Component() {
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) throw new Error('Failed');
      
      // Success handling
    } catch (e) {
      console.error('Submit failed:', e);
    } finally {
      setLoading(false);
    }
  }, [data]);
  
  return <div>...</div>;
}
```

## Database Queries

### Basic Select
```typescript
const { data, error } = await supabase
  .from('people')
  .select('*')
  .eq('type', 'patient')
  .order('created_at', { ascending: false })
  .limit(10);
```

### Insert with Return
```typescript
const { data, error } = await supabase
  .from('people')
  .insert({ 
    email, 
    name, 
    type: 'patient',
    metadata: { city, issue }
  })
  .select()
  .single();
```

### Update
```typescript
const { error } = await supabase
  .from('therapist_profiles')
  .update({ available: false })
  .eq('id', therapistId);
```

## Email Patterns

### Fire-and-Forget
```typescript
// Never blocks user flow
void sendEmail(params).catch(e => {
  void logError('email', e, { type: 'welcome' });
});
```

### German Templates
```typescript
const templates = {
  patientConfirmation: {
    subject: 'Ihre Anfrage bei Kaufmann Health erhalten',
    body: `Guten Tag ${name}, ...`
  },
  therapistWelcome: {
    subject: 'Willkommen bei Kaufmann Health',
    body: `Sehr geehrte/r ${name}, ...`
  }
};
```

## Analytics & Tracking Guidelines

**CRITICAL**: All features must follow the dual analytics system documented in `docs/analytics.md`.

**Quick Reference:**
- **Supabase Events**: Business logic, detailed user behavior, errors (`ServerAnalytics.trackEventFromRequest()`)
- **Vercel Analytics**: High-level funnel conversions only (`track('Major Event')`)
- **No duplication**: Different systems for different purposes

**For any new feature development:**
1. Check `docs/analytics.md` for event patterns
2. Plan tracking during feature design, not as afterthought  
3. Follow event naming conventions: `{page}-{location}-{action}[-{qualifier}]`
4. Always implement Supabase events for business logic
5. Only add Vercel events for major conversion milestones

**Common mistake to avoid**: Don't duplicate the same event in both systems. Each serves different analytical needs.

**When in doubt**: Check existing implementations in the codebase and follow established patterns from `docs/analytics.md`.

## Testing

### Quick Test Run
```bash
# Single file
npm test tests/patient-registration.test.ts

# Watch mode for development
npm test -- --watch

# Before deploy
npm run test:critical
```

### Mock Template
```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Setup mocks
vi.mock('@/lib/email/client');

describe('Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('does something', async () => {
    // Test implementation
  });
});
```

## Deployment Checklist

1. **Code Complete**
   - [ ] Tests pass: `npm run test:critical`
   - [ ] Build succeeds: `npm run build`
   - [ ] German translations verified

2. **Vercel Setup**
   - [ ] Environment variables set
   - [ ] Domain configured
   - [ ] Preview deployment tested

3. **Production Ready**
   - [ ] Admin login works
   - [ ] Email sending verified
   - [ ] Analytics tracking confirmed
   - [ ] Error logging operational

## Debugging

### Check Logs
```typescript
// In Vercel dashboard: Functions → Logs

// Local debugging
console.log('🔍 Debug:', { data });

// Production logging (goes to events table)
await track({
  type: 'debug',
  level: 'info',
  source: 'component.name',
  props: { data }
});
```

### Common Issues

**Email not sending:**
- Check RESEND_API_KEY in env
- Verify email templates exist
- Check error logs for details

**Admin auth failing:**
- Verify ADMIN_PASSWORD set
- Check cookie settings for production
- Ensure JWT secret consistent

**Database errors:**
- Check RLS policies
- Verify service role key for server
- Check column names match schema