/**
 * POST /api/admin/broadcasts/therapist-update
 *
 * Sync verified therapists to Resend audience and optionally send product update broadcast.
 *
 * Query params:
 *   ?action=sync        - Sync therapists to audience (default)
 *   ?action=preview     - Preview email content
 *   ?action=send        - Create and send broadcast
 *   ?action=send_test   - Send test email to LEADS_NOTIFY_EMAIL
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, ADMIN_SESSION_COOKIE } from '@/lib/auth/adminSession';
import { supabaseServer } from '@/lib/supabase-server';
import { track, logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import {
  getOrCreateTherapistAudience,
  syncTherapistsToAudience,
  createBroadcast,
  sendBroadcast,
  listContacts,
} from '@/lib/resend/audiences';
import { renderTherapistProductUpdate } from '@/lib/email/templates/therapistProductUpdate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_FROM = process.env.LEADS_FROM_EMAIL || 'noreply@kaufmann-health.de';

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get('action') || 'sync';

  try {
    if (action === 'preview') {
      // Preview the email content
      const content = renderTherapistProductUpdate({ name: 'Max' });
      return NextResponse.json({
        action: 'preview',
        subject: content.subject,
        html: content.html,
      });
    }

    if (action === 'send_test') {
      // Send test email to admin
      const testEmail = process.env.LEADS_NOTIFY_EMAIL;
      if (!testEmail) {
        return NextResponse.json({ error: 'LEADS_NOTIFY_EMAIL not configured' }, { status: 400 });
      }

      const content = renderTherapistProductUpdate({ name: 'Test-Therapeut:in' });
      const result = await sendEmail({
        to: testEmail,
        subject: `[TEST] ${content.subject}`,
        html: content.html,
        context: { kind: 'therapist_product_update', test: true },
      });

      return NextResponse.json({
        action: 'send_test',
        sent: result.sent,
        to: testEmail,
      });
    }

    // Fetch verified therapists
    const { data: therapists, error: therapistError } = await supabaseServer
      .from('therapists')
      .select('id, email, first_name, last_name')
      .eq('status', 'verified')
      .not('email', 'is', null);

    if (therapistError) {
      throw therapistError;
    }

    const therapistCount = therapists?.length || 0;

    if (action === 'sync') {
      // Sync therapists to Resend audience
      const syncResult = await syncTherapistsToAudience(
        therapists?.map(t => ({
          email: t.email!,
          first_name: t.first_name || undefined,
          last_name: t.last_name || undefined,
        })) || []
      );

      if (syncResult.error) {
        throw new Error(syncResult.error);
      }

      await track({
        type: 'therapist_audience_synced',
        level: 'info',
        source: 'api.admin.broadcasts.therapist-update',
        props: {
          therapist_count: therapistCount,
          ...syncResult.data,
        },
      });

      return NextResponse.json({
        action: 'sync',
        therapist_count: therapistCount,
        ...syncResult.data,
      });
    }

    if (action === 'send') {
      // Get audience ID
      const audienceResult = await getOrCreateTherapistAudience();
      if (audienceResult.error || !audienceResult.data) {
        throw new Error(audienceResult.error || 'Failed to get audience');
      }

      // Get contact count for confirmation
      const contactsResult = await listContacts(audienceResult.data);
      const contactCount = contactsResult.data?.filter(c => !c.unsubscribed).length || 0;

      if (contactCount === 0) {
        return NextResponse.json({
          error: 'No contacts in audience. Run ?action=sync first.',
        }, { status: 400 });
      }

      // Create broadcast
      const content = renderTherapistProductUpdate({});
      if (!content.html) {
        throw new Error('Email template returned no HTML');
      }
      const broadcastResult = await createBroadcast({
        audienceId: audienceResult.data,
        from: `Kaufmann Health <${EMAIL_FROM}>`,
        subject: content.subject,
        html: content.html,
        replyTo: EMAIL_FROM,
        name: `Product Update: Client Booking Feature - ${new Date().toISOString().split('T')[0]}`,
      });

      if (broadcastResult.error || !broadcastResult.data) {
        throw new Error(broadcastResult.error || 'Failed to create broadcast');
      }

      // Send immediately
      const sendResult = await sendBroadcast(broadcastResult.data.id);
      if (sendResult.error) {
        throw new Error(sendResult.error);
      }

      await track({
        type: 'therapist_broadcast_sent',
        level: 'info',
        source: 'api.admin.broadcasts.therapist-update',
        props: {
          broadcast_id: broadcastResult.data.id,
          contact_count: contactCount,
          subject: content.subject,
        },
      });

      return NextResponse.json({
        action: 'send',
        broadcast_id: broadcastResult.data.id,
        contact_count: contactCount,
        subject: content.subject,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    await logError('api.admin.broadcasts.therapist-update', e, { action });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
