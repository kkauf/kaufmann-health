import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email/client';
import { ServerAnalytics } from '@/lib/server-analytics';
import { logError } from '@/lib/logger';
import { extractIpFromHeaders } from '@/lib/rate-limit';
import { getLeadsNotifyEmail } from '@/lib/email/notification-recipients';

export const runtime = 'nodejs';

/**
 * @endpoint POST /api/public/feedback/interview-interest
 * @description Tracks interview interest and sends immediate notification to admin
 * @body { patient_id: string, source?: string }
 * @returns { data: { received: true }, error: null }
 */
export async function POST(req: Request) {
  const ip = extractIpFromHeaders(req.headers);
  const ua = req.headers.get('user-agent') || undefined;

  try {
    const { patient_id, source } = (await req.json()) as {
      patient_id?: string;
      source?: string;
    };

    if (!patient_id || typeof patient_id !== 'string') {
      return NextResponse.json({ data: null, error: 'Missing patient_id' }, { status: 400 });
    }

    // Track the event
    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'interview_interest',
      source: 'api.feedback.interview_interest',
      props: { patient_id, source: source || 'feedback_page' },
    });

    // Fetch patient info for notification
    const { data: patient } = await supabaseServer
      .from('people')
      .select('id, name, email, phone_number, metadata')
      .eq('id', patient_id)
      .single();

    const patientName = patient?.name || 'Unbekannt';
    const patientEmail = patient?.email || 'Keine Email';
    const patientPhone = patient?.phone_number || '';
    const city = (patient?.metadata as Record<string, unknown>)?.city || 'Unbekannt';

    // Send immediate notification
    const notifyEmail = getLeadsNotifyEmail();
    if (notifyEmail) {
      const subject = `🎯 Interview-Interesse: ${patientName} (${city})`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #4f46e5;">Jemand möchte ein Interview!</h2>
          <p>Ein Klient hat Interesse an einem 15-minütigen Feedback-Gespräch gezeigt (€25 Amazon-Gutschein).</p>
          
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Name:</strong> ${patientName}</p>
            <p style="margin: 4px 0;"><strong>Email:</strong> ${patientEmail}</p>
            ${patientPhone ? `<p style="margin: 4px 0;"><strong>Telefon:</strong> ${patientPhone}</p>` : ''}
            <p style="margin: 4px 0;"><strong>Stadt:</strong> ${city}</p>
            <p style="margin: 4px 0;"><strong>Patient ID:</strong> ${patient_id}</p>
          </div>
          
          <p style="color: #dc2626; font-weight: 600;">⚡ Bitte zeitnah kontaktieren!</p>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
            Quelle: ${source || 'Day 10 Feedback Email'}
          </p>
        </div>
      `;

      void sendEmail({
        to: notifyEmail,
        subject,
        html,
        context: { kind: 'interview_interest_notification', patient_id },
      }).catch((e) => {
        void logError('api.feedback.interview_interest', e, { stage: 'send_notification' }, ip, ua);
      });
    }

    return NextResponse.json({ data: { received: true }, error: null });
  } catch (e) {
    await logError('api.feedback.interview_interest', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Failed' }, { status: 500 });
  }
}
