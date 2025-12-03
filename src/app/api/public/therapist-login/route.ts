import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistMagicLink } from '@/lib/email/templates/therapistMagicLink';
import { createTherapistSessionToken } from '@/lib/auth/therapistSession';
import { BASE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/public/therapist-login
 * 
 * Request magic link for therapist portal access.
 * Only verified therapists can request a login link.
 * 
 * Request body: { email: string }
 * 
 * Response: Always returns success to prevent email enumeration.
 */
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';

    if (!email || !email.includes('@')) {
      // Don't reveal validation details - just say we'll send if valid
      return NextResponse.json({ 
        data: { ok: true, message: 'Falls ein Konto existiert, senden wir einen Login-Link.' },
        error: null 
      });
    }

    // Look up therapist by email
    const { data: therapist, error: fetchErr } = await supabaseServer
      .from('therapists')
      .select('id, email, first_name, last_name, status')
      .eq('email', email)
      .single();

    if (fetchErr || !therapist) {
      // Don't reveal whether email exists
      void track({
        type: 'therapist_login_not_found',
        level: 'info',
        source: 'api.therapist-login',
        ip,
        ua,
        props: { email_hash: email.substring(0, 3) + '***' },
      });
      return NextResponse.json({ 
        data: { ok: true, message: 'Falls ein Konto existiert, senden wir einen Login-Link.' },
        error: null 
      });
    }

    // Only verified therapists can log in
    if (therapist.status !== 'verified') {
      void track({
        type: 'therapist_login_not_verified',
        level: 'info',
        source: 'api.therapist-login',
        ip,
        ua,
        props: { therapist_id: therapist.id, status: therapist.status },
      });
      return NextResponse.json({ 
        data: { ok: true, message: 'Falls ein Konto existiert, senden wir einen Login-Link.' },
        error: null 
      });
    }

    // Generate magic link token
    const name = [therapist.first_name || '', therapist.last_name || ''].join(' ').trim() || undefined;
    const token = await createTherapistSessionToken({
      therapist_id: therapist.id,
      email: therapist.email,
      name,
    });

    // Build magic link URL (goes through auth route to set cookie)
    const magicLinkUrl = `${BASE_URL}/portal/auth?token=${encodeURIComponent(token)}`;

    // Render and send email
    const emailContent = renderTherapistMagicLink({
      name: therapist.first_name || name,
      magicLinkUrl,
    });

    const sent = await sendEmail({
      to: therapist.email,
      subject: emailContent.subject,
      html: emailContent.html,
      context: {
        kind: 'therapist_magic_link',
        therapist_id: therapist.id,
      },
    });

    if (!sent) {
      // Log but don't reveal to user
      await logError('api.therapist-login', { name: 'EmailFailed', message: 'Failed to send magic link' }, {
        therapist_id: therapist.id,
      }, ip, ua);
    }

    void track({
      type: 'therapist_login_requested',
      level: 'info',
      source: 'api.therapist-login',
      ip,
      ua,
      props: { 
        therapist_id: therapist.id,
        email_sent: sent,
      },
    });

    return NextResponse.json({ 
      data: { ok: true, message: 'Falls ein Konto existiert, senden wir einen Login-Link.' },
      error: null 
    });

  } catch (e) {
    await logError('api.therapist-login', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ 
      data: null, 
      error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' 
    }, { status: 500 });
  }
}
