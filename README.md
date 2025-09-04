# Kaufmann Health Development Guidelines

## Core Architecture Decisions

**Tech Stack:**
- **Frontend:** Next.js App Router, TypeScript, Tailwind, ShadCN/UI
- **Backend:** Next.js API routes, Supabase (PostgreSQL + RLS)
- **Email:** Resend API (German templates)
- **Deployment:** Vercel
- **Analytics:** Server-side first (no cookie banners needed)

**Key Patterns:**
1. **Unified events table** - Single table for errors + analytics
2. **Fire-and-forget operations** - Email/logging never blocks user flow
3. **PII-safe by default** - IP hashing with `IP_HASH_SALT`
4. **GDPR-first** - Server-side tracking, German language, compliance built-in
5. **Manual-first MVP** - Admin tools before automation

**Database Patterns:**
- UUID defaults on all tables
- `timestamptz` for all timestamps
- Metadata JSON for flexible form storage
- Service role for server operations only
- Proper indexing on query columns

**Security:**
- Admin: Simple password + JWT (24hr expiry)
- Magic links: Secure UUIDs (72hr expiration)
- Rate limiting on sensitive endpoints

## Common Code Patterns

**Event Tracking:**
```typescript
await track({
  type: 'lead_submitted',
  level: 'info',
  source: 'api.leads',
  props: { lead_type: 'patient', city: city || null }
});
```

**Error Logging:**
```typescript
catch (e) {
  void logError('api.leads', e, { stage: 'validation' }, ip, ua);
  return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
}
```

**Fire-and-Forget Email:**
```typescript
void sendConfirmationEmail(data).catch(() => {
  void logError('email', 'send_failed', { type: 'confirmation' });
});
```

## Testing Strategy

**Critical Business Flows (Must Have E2E Tests):**
1. **Patient Registration** → DB record → Confirmation email → Admin notification
2. **Therapist Registration** → Contract binding → Welcome email
3. **Manual Matching** → Therapist outreach → Response tracking

**Testing Principles:**
- Tests as documentation of actual behavior
- Test user-facing outcomes, not implementation
- Mock fire-and-forget operations (email, logging)
- All critical flows must pass before deploy

See `tests/README.md` for implementation details.

## Deployment Checklist

**Environment Variables Required:**
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
IP_HASH_SALT=
RESEND_API_KEY=
LEADS_NOTIFY_EMAIL=
LEADS_FROM_EMAIL=
ADMIN_PASSWORD=
```

**Before Production:**
1. Run health check: `npm run test:critical`
2. Verify environment variables in Vercel
3. Test German email templates
4. Confirm admin authentication works
5. Verify analytics events firing
6. Check error logging operational

**Success Metrics:**
- Landing → Signup: >15%
- Signup → Profile completion: >80%
- CAC: <€50
- Match success rate: >60%

## Project Docs
- Architecture: `docs/architecture.md`
- Data model: `docs/data-model.md`
- Security decisions: `docs/security.md`
- Technical decisions: `docs/technical-decisions.md`
- API: `docs/api.md`
- Development: `docs/development.md`
- Project structure: `docs/project-structure.md`

## License
Licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
