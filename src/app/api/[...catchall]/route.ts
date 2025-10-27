import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import { getFixedWindowLimiter, extractIpFromHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rate limit for API discovery protection (10 requests per minute per IP)
const ATTACK_LIMITER = getFixedWindowLimiter('api_404_protection', 10, 60000);

// Critical API patterns that should NEVER 404 - these indicate broken email links or production issues
const CRITICAL_PATTERNS = [
  { pattern: /^\/api\/match\/[^/]+\/(select|respond)/, name: 'patient_therapist_magic_links' },
  { pattern: /^\/api\/therapists\/opt-out/, name: 'therapist_opt_out' },
  { pattern: /^\/api\/leads\/(confirm|resend-confirmation)/, name: 'lead_confirmation' },
  { pattern: /^\/api\/leads\/[^/]+\/preferences/, name: 'lead_preferences' },
];

function sanitizeQuery(req: NextRequest): string | null {
  try {
    const u = new URL(req.url);
    if (!u.search) return null;
    const sp = u.searchParams;
    const redacted = new URLSearchParams();
    const SENSITIVE = new Set(['token', 'email_token', 'id', 'fs']);
    for (const [k, v] of sp.entries()) {
      redacted.set(k, SENSITIVE.has(k) ? 'REDACTED' : v);
    }
    const s = redacted.toString();
    return s ? `?${s}` : null;
  } catch {
    return null;
  }
}

async function handle(req: NextRequest) {
  const pathname = new URL(req.url).pathname;
  const ip = extractIpFromHeaders(req.headers);

  // Apply rate limiting for API discovery protection
  const rateLimit = ATTACK_LIMITER.check(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { 
        status: 429, 
        headers: { 'Retry-After': rateLimit.retryAfterSec.toString() } 
      }
    );
  }

  // Check if this is a critical endpoint that should never 404
  const criticalMatch = CRITICAL_PATTERNS.find(({ pattern }) => pattern.test(pathname));

  if (criticalMatch) {
    // CRITICAL: Log this as a high-severity error - broken magic link/email flow
    await logError(
      'api.404.critical',
      new Error(`CRITICAL: 404 on ${criticalMatch.name} endpoint - broken email/magic link`),
      {
        pathname,
        query: sanitizeQuery(req),
        method: req.method,
        pattern: criticalMatch.name,
        referrer: req.headers.get('referer') || null,
        userAgent: req.headers.get('user-agent')?.slice(0, 200) || null,
        ip,
        severity: 'CRITICAL',
        impact: 'Business flow broken - users cannot complete action',
      }
    );
  } else {
    // Non-critical 404, still log for monitoring
    await logError(
      'api.404',
      new Error(`API route not found: ${pathname}`),
      {
        pathname,
        query: sanitizeQuery(req),
        method: req.method,
        ip,
        userAgent: req.headers.get('user-agent')?.slice(0, 200) || null,
      }
    );
  }

  return NextResponse.json(
    {
      error: 'Not found',
      message: 'The requested API endpoint does not exist',
    },
    { status: 404 }
  );
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function PUT(req: NextRequest) {
  return handle(req);
}

export async function DELETE(req: NextRequest) {
  return handle(req);
}

export async function PATCH(req: NextRequest) {
  return handle(req);
}
