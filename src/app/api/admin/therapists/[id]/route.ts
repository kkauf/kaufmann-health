import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { createTherapistSessionToken } from '@/lib/auth/therapistSession';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistApproval } from '@/lib/email/templates/therapistApproval';
import { renderTherapistRejection } from '@/lib/email/templates/therapistRejection';
import { renderTherapistDecline } from '@/lib/email/templates/therapistDecline';
import { BASE_URL } from '@/lib/constants';
import { provisionCalUser, isCalProvisioningEnabled, getSquareAvatarUrl, type CalProvisionResult } from '@/lib/cal/provision';
import { AdminTherapistPatchInput } from '@/contracts/admin';
import { parseRequestBody } from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k && typeof v === 'string') map.set(k, decodeURIComponent(v));
  }
  return map;
}

async function assertAdmin(req: Request): Promise<boolean> {
  try {
    const header = req.headers.get('cookie');
    const token = parseCookie(header).get(ADMIN_SESSION_COOKIE);
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get('host') || '';
  if (!host) return true; // allow server-to-server/test requests
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  if (!origin && !referer) return true; // allow server-to-server/test requests
  const http = `http://${host}`;
  const https = `https://${host}`;
  if (origin === http || origin === https) return true;
  if (referer.startsWith(http + '/')) return true;
  if (referer.startsWith(https + '/')) return true;
  return false;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const { data: row, error } = await supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, email, phone, city, status, metadata, photo_url, cal_username, cal_enabled, cal_user_id')
      .eq('id', id)
      .single();
    if (error || !row) {
      await logError('admin.api.therapists.detail', error, { stage: 'fetch', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    function isObject(v: unknown): v is Record<string, unknown> {
      return typeof v === 'object' && v !== null;
    }
    const meta = (row as Record<string, unknown>).metadata;
    const metadata = isObject(meta) ? meta : {};
    const profile = isObject((metadata as Record<string, unknown>).profile)
      ? ((metadata as Record<string, unknown>).profile as Record<string, unknown>)
      : {};
    const pendingPath = typeof profile.photo_pending_path === 'string' ? (profile.photo_pending_path as string) : undefined;
    const practiceAddress = typeof profile.practice_address === 'string' ? (profile.practice_address as string) : undefined;
    const approachText = typeof profile.approach_text === 'string'
      ? (profile.approach_text as string)
      : (typeof (row as Record<string, unknown>).approach_text === 'string' ? ((row as Record<string, unknown>).approach_text as string) : undefined);

    let photo_pending_url: string | undefined;
    if (pendingPath) {
      const { data: signed, error: signErr } = await supabaseServer.storage
        .from('therapist-applications')
        .createSignedUrl(pendingPath, 60 * 5);
      if (!signErr && signed?.signedUrl) {
        photo_pending_url = signed.signedUrl;
      }
    }

    // Extract document metadata
    const documents = isObject((metadata as Record<string, unknown>).documents)
      ? ((metadata as Record<string, unknown>).documents as Record<string, unknown>)
      : {};
    const hasLicense = typeof documents.license === 'string' && documents.license.length > 0;
    const specialization = isObject(documents.specialization) ? (documents.specialization as Record<string, string[]>) : {};
    const hasSpecialization = Object.keys(specialization).length > 0;
    
    // Get selected modalities from metadata
    const modalities = Array.isArray((metadata as Record<string, unknown>).specializations)
      ? ((metadata as Record<string, unknown>).specializations as string[])
      : [];

    const name = [row.first_name || '', row.last_name || ''].join(' ').trim() || null;
    const rowAny = row as Record<string, unknown>;
    return NextResponse.json({
      data: {
        id: row.id,
        name,
        email: row.email || null,
        phone: row.phone || null,
        city: row.city || null,
        status: row.status || 'pending_verification',
        profile: {
          photo_pending_url,
          approach_text: approachText,
          photo_url: rowAny.photo_url || undefined,
          practice_address: practiceAddress,
        },
        documents: {
          has_license: hasLicense,
          has_specialization: hasSpecialization,
          specialization_certs: specialization, // { slug: [paths] }
        },
        modalities, // Selected modalities from signup
        // Cal.com integration
        cal_username: typeof rowAny.cal_username === 'string' ? rowAny.cal_username : null,
        cal_enabled: Boolean(rowAny.cal_enabled),
        cal_user_id: typeof rowAny.cal_user_id === 'number' ? rowAny.cal_user_id : null,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.therapists.detail', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  if (process.env.NODE_ENV === 'production' && !sameOrigin(req)) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = await ctx.params;
    const parsed = await parseRequestBody(req, AdminTherapistPatchInput);
    if (!parsed.success) return parsed.response;

    const payload: Record<string, unknown> =
      parsed.data && typeof parsed.data === 'object' ? (parsed.data as Record<string, unknown>) : {};

    const status = typeof payload.status === 'string' ? payload.status : undefined;
    const verification_notes = typeof payload.verification_notes === 'string' ? payload.verification_notes : undefined;
    const approve_profile = Boolean(payload.approve_profile);
    const approach_text = typeof payload.approach_text === 'string' ? String(payload.approach_text) : undefined;
    let practice_address = typeof payload.practice_address === 'string' ? String(payload.practice_address) : undefined;
    if (!practice_address) {
      try {
        const profile = (payload.profile as unknown);
        const nested = (profile && typeof profile === 'object' ? (profile as Record<string, unknown>).practice_address : undefined) as unknown;
        if (typeof nested === 'string') practice_address = nested;
      } catch {}
    }
    // Cal.com integration fields (admin can manually set/override)
    const cal_username = typeof payload.cal_username === 'string' ? payload.cal_username.trim() : undefined;
    const cal_enabled = typeof payload.cal_enabled === 'boolean' ? payload.cal_enabled : undefined;
    // Booking gating: require intro before full session booking
    const requires_intro_before_booking = typeof payload.requires_intro_before_booking === 'boolean' ? payload.requires_intro_before_booking : undefined;

    const hasCalFields = cal_username !== undefined || cal_enabled !== undefined;
    const hasBookingSettings = requires_intro_before_booking !== undefined;
    if (!status && typeof verification_notes !== 'string' && !approve_profile && typeof approach_text !== 'string' && typeof practice_address !== 'string' && !hasCalFields && !hasBookingSettings) {
      return NextResponse.json({ data: null, error: 'Missing fields' }, { status: 400 });
    }
    if (status && !['pending_verification', 'verified', 'rejected', 'declined'].includes(status)) {
      return NextResponse.json({ data: null, error: 'Invalid status' }, { status: 400 });
    }
    if (approach_text && approach_text.length > 500) {
      return NextResponse.json({ data: null, error: 'approach_text too long (max 500 chars)' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (typeof verification_notes === 'string') update.verification_notes = verification_notes;
    // Cal.com fields can be set/overridden by admin
    if (cal_username !== undefined) update.cal_username = cal_username || null;
    if (cal_enabled !== undefined) update.cal_enabled = cal_enabled;

    // Load current metadata to optionally update profile info and process photo approval
    const { data: current, error: fetchErr } = await supabaseServer
      .from('therapists')
      .select('metadata, photo_url, status')
      .eq('id', id)
      .single();
    if (fetchErr) {
      await logError('admin.api.therapists.update', fetchErr, { stage: 'fetch', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    function isObject(v: unknown): v is Record<string, unknown> {
      return typeof v === 'object' && v !== null;
    }
    const currMeta = isObject(current?.metadata) ? (current!.metadata as Record<string, unknown>) : {};
    const beforeStatus = typeof (current as { status?: string | null } | null)?.status === 'string'
      ? ((current as { status?: string | null }).status as string)
      : undefined;
    const profileMeta = isObject(currMeta.profile) ? (currMeta.profile as Record<string, unknown>) : {};

    // Safety: once verified, do not allow status downgrades (accidental clicks / test-profile edits)
    if (beforeStatus === 'verified' && status && status !== 'verified') {
      return NextResponse.json({ data: null, error: 'Cannot change status for verified therapist' }, { status: 400 });
    }

    if (typeof approach_text === 'string') {
      profileMeta.approach_text = approach_text;
    }
    if (typeof practice_address === 'string') {
      profileMeta.practice_address = practice_address.trim();
    }

    // Update booking_settings in metadata if requires_intro_before_booking is provided
    if (requires_intro_before_booking !== undefined) {
      const bookingSettings = isObject(currMeta.booking_settings)
        ? (currMeta.booking_settings as Record<string, unknown>)
        : {};
      bookingSettings.requires_intro_before_booking = requires_intro_before_booking;
      currMeta.booking_settings = bookingSettings;
    }

    if (approve_profile) {
      const pendingPath = typeof profileMeta.photo_pending_path === 'string' ? (profileMeta.photo_pending_path as string) : undefined;
      if (!pendingPath) {
        return NextResponse.json({ data: null, error: 'No pending profile photo to approve' }, { status: 400 });
      }
      // Download from applications bucket
      const { data: file, error: dlErr } = await supabaseServer.storage
        .from('therapist-applications')
        .download(pendingPath);
      if (dlErr || !file) {
        await logError('admin.api.therapists.update', dlErr, { stage: 'download_profile_photo', path: pendingPath });
        return NextResponse.json({ data: null, error: 'Failed to read pending photo' }, { status: 500 });
      }
      const ab = await file.arrayBuffer();
      const buf = Buffer.from(ab);
      const extMatch = pendingPath.toLowerCase().match(/\.(jpg|jpeg|png)$/);
      const ext = extMatch ? (extMatch[1] === 'jpeg' ? '.jpg' : `.${extMatch[1]}`) : '.jpg';
      const publicBucket = 'therapist-profiles';
      const destPath = `${id}${ext}`;
      const { error: upErr } = await supabaseServer.storage
        .from(publicBucket)
        .upload(destPath, buf, { contentType: ext === '.png' ? 'image/png' : 'image/jpeg', upsert: true });
      if (upErr) {
        await logError('admin.api.therapists.update', upErr, { stage: 'upload_public_photo', dest: destPath });
        return NextResponse.json({ data: null, error: 'Failed to publish photo' }, { status: 500 });
      }
      // Remove pending file (best-effort)
      await supabaseServer.storage.from('therapist-applications').remove([pendingPath]).catch(() => {});

      const { data: pub } = supabaseServer.storage.from(publicBucket).getPublicUrl(destPath);
      const photo_url = pub?.publicUrl;
      if (photo_url) {
        update.photo_url = photo_url;
      }
      // Clear pending path
      delete profileMeta.photo_pending_path;
    }

    // Store verified_at timestamp when approving
    if (status === 'verified' && beforeStatus !== 'verified') {
      currMeta.verified_at = new Date().toISOString();
    }

    const newMeta: Record<string, unknown> = { ...currMeta, profile: profileMeta };
    update.metadata = newMeta;

    // If declining (terminal), require verification_notes as the reason.
    const decliningNow = status === 'declined' && beforeStatus !== 'declined';
    if (decliningNow) {
      if (!(verification_notes || '').trim()) {
        return NextResponse.json({ data: null, error: 'verification_notes required for decline (reason for therapist)' }, { status: 400 });
      }
    }

    // If rejecting (transient, needs fixes), ensure the email will include a meaningful reason.
    const rejectingNow = status === 'rejected' && beforeStatus !== 'rejected';
    let rejectionMissingDocuments = false;
    let rejectionPhotoIssue: string | null = null;
    let rejectionApproachIssue: string | null = null;
    let rejectionLink: string | undefined;

    if (rejectingNow) {
      const docsUnknown = (currMeta as { documents?: unknown }).documents;
      const docs = isObject(docsUnknown) ? (docsUnknown as Record<string, unknown>) : {};
      const hasLicense = typeof docs.license === 'string' && (docs.license as string).length > 0;
      rejectionMissingDocuments = !hasLicense;

      const hasPhotoPending = typeof profileMeta.photo_pending_path === 'string' && (profileMeta.photo_pending_path as string).length > 0;
      const photoUrl =
        (typeof update.photo_url === 'string' && (update.photo_url as string)) ||
        ((current as { photo_url?: string | null })?.photo_url || null);
      const hasPhotoApproved = typeof photoUrl === 'string' && photoUrl.length > 0;
      if (!hasPhotoApproved && !hasPhotoPending) {
        rejectionPhotoIssue = 'Bitte lade ein Profilfoto hoch.';
      }

      const approach = typeof profileMeta.approach_text === 'string' ? (profileMeta.approach_text as string).trim() : '';
      if (!approach) {
        rejectionApproachIssue = 'Bitte ergänze eine kurze Ansatz‑Beschreibung.';
      }

      const hasAnyReason =
        Boolean(rejectionMissingDocuments) || Boolean(rejectionPhotoIssue) || Boolean(rejectionApproachIssue) || Boolean((verification_notes || '').trim());
      if (!hasAnyReason) {
        return NextResponse.json({ data: null, error: 'verification_notes required for rejection' }, { status: 400 });
      }

      rejectionLink = rejectionMissingDocuments
        ? `${BASE_URL}/therapists/upload-documents/${id}`
        : `${BASE_URL}/therapists/complete-profile/${id}`;
    }

    // Cal.com provisioning: when transitioning to verified, provision Cal.com user
    let calResult: CalProvisionResult | null = null;
    const isNewlyVerified = status === 'verified' && beforeStatus !== 'verified';

    if (isNewlyVerified && isCalProvisioningEnabled()) {
      // Fetch therapist details for Cal provisioning
      const { data: therapistForCal } = await supabaseServer
        .from('therapists')
        .select('first_name, last_name, email, photo_url, metadata, cal_user_id, cal_username, cal_enabled')
        .eq('id', id)
        .single();

      const therapistEmail = (therapistForCal as { email?: string | null })?.email;
      const existingCalUserId = (therapistForCal as { cal_user_id?: number | null })?.cal_user_id;
      const existingCalUsername = (therapistForCal as { cal_username?: string | null })?.cal_username;
      const patchedCalUsername = cal_username !== undefined ? cal_username : undefined;
      const hasStoredCalUrl = Boolean(String(patchedCalUsername || existingCalUsername || '').trim());

      // Only provision if no existing Cal user and email exists
      if (therapistEmail && !existingCalUserId && !hasStoredCalUrl) {
        try {
          // Extract photo URL and practice address for Cal.com profile
          const calPhotoUrl = (therapistForCal as { photo_url?: string | null })?.photo_url;
          const calMeta = (therapistForCal as { metadata?: { profile?: { practice_address?: string } } | null })?.metadata;
          const calPracticeAddress = calMeta?.profile?.practice_address;

          calResult = await provisionCalUser({
            email: therapistEmail,
            firstName: String((therapistForCal as { first_name?: string | null })?.first_name || ''),
            lastName: String((therapistForCal as { last_name?: string | null })?.last_name || ''),
            timeZone: 'Europe/Berlin',
            avatarUrl: getSquareAvatarUrl(calPhotoUrl),
            practiceAddress: calPracticeAddress,
          });

          // Store Cal.com user info in KH therapists table
          update.cal_user_id = calResult.cal_user_id;
          update.cal_username = calResult.cal_username;
          update.cal_enabled = true;
          if (calResult.cal_intro_event_type_id) {
            update.cal_intro_event_type_id = calResult.cal_intro_event_type_id;
          }
          if (calResult.cal_full_session_event_type_id) {
            update.cal_full_session_event_type_id = calResult.cal_full_session_event_type_id;
          }

          void track({
            type: 'cal_user_provisioned',
            level: 'info',
            source: 'admin.api.therapists.update',
            props: {
              therapist_id: id,
              cal_user_id: calResult.cal_user_id,
              cal_username: calResult.cal_username,
            },
          });
        } catch (calErr) {
          // Log error but don't fail the verification
          await logError('admin.api.therapists.update', calErr, {
            stage: 'cal_provision_failed',
            therapist_id: id,
            email: therapistEmail,
          });
          // Continue without Cal provisioning
        }
      }
    }

    const { error } = await supabaseServer
      .from('therapists')
      .update(update)
      .eq('id', id);

    if (error) {
      await logError('admin.api.therapists.update', error, { therapist_id: id });
      return NextResponse.json({ data: null, error: 'Failed to update therapist' }, { status: 500 });
    }

    try {
      const { data: after } = await supabaseServer
        .from('therapists')
        .select('first_name, last_name, email, status, photo_url')
        .eq('id', id)
        .single();
      const to = (after as { email?: string | null })?.email || undefined;
      const name = [
        (after as { first_name?: string | null })?.first_name || '',
        (after as { last_name?: string | null })?.last_name || '',
      ].join(' ').trim();
      const finalStatus = (after as { status?: string | null })?.status || undefined;
      // Only send status emails when THIS request explicitly changed status.
      if (to && status === 'verified' && finalStatus === 'verified' && beforeStatus !== 'verified') {
        const visible = Boolean((after as { photo_url?: string | null })?.photo_url);
        // Generate magic link token for portal access
        const portalToken = await createTherapistSessionToken({
          therapist_id: id,
          email: to,
          name: name || undefined,
        });
        const portalUrl = `${BASE_URL}/portal/auth?token=${encodeURIComponent(portalToken)}`;
        const approval = renderTherapistApproval({
          name,
          profileVisible: visible,
          calLoginUrl: calResult?.cal_login_url,
          calEmail: to,
          calUsername: calResult?.cal_username,
          calPassword: calResult?.cal_password,
          portalUrl,
        });
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.therapists.update', props: { stage: 'therapist_approval', therapist_id: id, subject: approval.subject } });
        const approvalResult = await sendEmail({ to, subject: approval.subject, html: approval.html, context: { stage: 'therapist_approval', therapist_id: id } });
        if (!approvalResult.sent && approvalResult.reason === 'failed') {
          await logError('admin.api.therapists.update', new Error('Approval email send failed'), { stage: 'therapist_approval_send_failed', therapist_id: id, email: to });
        }
      } else if (to && status === 'rejected' && finalStatus === 'rejected' && beforeStatus !== 'rejected') {
        // Transient rejection - needs fixes, can resubmit
        const uploadUrl = rejectionLink || `${BASE_URL}/therapists/complete-profile/${id}`;
        const rejection = renderTherapistRejection({
          name,
          uploadUrl,
          missingDocuments: rejectionMissingDocuments,
          photoIssue: rejectionPhotoIssue,
          approachIssue: rejectionApproachIssue,
          adminNotes: verification_notes || null,
        });
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.therapists.update', props: { stage: 'therapist_rejection', therapist_id: id, subject: rejection.subject } });
        const rejectionResult = await sendEmail({ to, subject: rejection.subject, html: rejection.html, context: { stage: 'therapist_rejection', therapist_id: id } });
        if (!rejectionResult.sent && rejectionResult.reason === 'failed') {
          await logError('admin.api.therapists.update', new Error('Rejection email send failed'), { stage: 'therapist_rejection_send_failed', therapist_id: id, email: to });
        }
      } else if (to && status === 'declined' && finalStatus === 'declined' && beforeStatus !== 'declined') {
        // Terminal decline - not accepted into network
        const decline = renderTherapistDecline({
          name,
          reason: verification_notes || '',
        });
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.therapists.update', props: { stage: 'therapist_decline', therapist_id: id, subject: decline.subject } });
        const declineResult = await sendEmail({ to, subject: decline.subject, html: decline.html, context: { stage: 'therapist_decline', therapist_id: id } });
        if (!declineResult.sent && declineResult.reason === 'failed') {
          await logError('admin.api.therapists.update', new Error('Decline email send failed'), { stage: 'therapist_decline_send_failed', therapist_id: id, email: to });
        }
      }
    } catch (e) {
      await logError('admin.api.therapists.update', e, { stage: 'send_status_email', therapist_id: id });
    }

    return NextResponse.json({
      data: {
        ok: true,
        cal_provisioned: Boolean(calResult),
        cal_username: calResult?.cal_username,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.therapists.update', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
