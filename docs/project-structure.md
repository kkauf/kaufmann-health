# Project Structure

```
/src
  /app
    page.tsx                # Homepage (UI only)
    /therapie-finden
      page.tsx              # Funnel page for prospective clients
    /fuer-therapeuten
      page.tsx              # Therapist CTA page (mailto)
    /impressum
      page.tsx
    /agb
      page.tsx
    /datenschutz
      page.tsx
    /api
      /leads
        route.ts            # Server-only form handler (service role)
  /components
    FunnelForm.tsx          # Client form (posts to /api/leads)
    Header.tsx
    Footer.tsx
    /ui                     # shadcn/ui primitives
      button.tsx
      input.tsx
      card.tsx
      select.tsx
      form.tsx
      label.tsx
  /lib
    supabase.ts             # Browser client placeholder
    supabase-server.ts      # Server-side client (service role)
```

Notes:
- Components = UI only. Business logic lives in hooks/lib or API routes.
- Keep state near usage. Use context only when prop drilling >3 levels.
- API returns `{ data, error }` consistently.
