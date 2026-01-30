import { safeJson } from '@/lib/http';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { getTherapistSession } from '@/lib/auth/therapistSession';
import { isValidSchwerpunktId } from '@/lib/schwerpunkte';
import { SERVER_PROFILE_LIMITS } from '@/lib/config/profileLimits';
import { TherapistProfileUpdate } from '@/contracts/therapist-profile';
import { parseFormData, parseRequestBody } from '@/lib/api-utils';
import { syncPracticeAddressToCal } from '@/lib/cal/syncAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB
const PUBLIC_PHOTO_BUCKET = 'therapist-profiles';
const PENDING_PHOTO_BUCKET = 'therapist-applications';

function getFileExtension(fileName: string, contentType: string): string {
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/png') return '.png';
  const m = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return m ? `.${m[1].toLowerCase()}` : '';
}

function isValidPhoto(file: File): { ok: true } | { ok: false; reason: string } {
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) return { ok: false, reason: 'Unsupported file type' };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, reason: 'File too large' };
  return { ok: true };
}

async function fileToBuffer(file: File): Promise<Buffer> {
  const ab = await file.arrayBuffer();
  return Buffer.from(ab);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function mapProfileContractError(message: string): string {
  if (message.includes('invalid gender')) return 'invalid gender';
  if (message.startsWith('session_preferences')) return 'invalid session_preferences';
  return message;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    // Fetch therapist
    const { data: therapist, error: fetchErr } = await supabaseServer
      .from('therapists')
      .select('id, status, metadata, gender, city, accepting_new, session_preferences, typical_rate')
      .eq('id', id)
      .single();

    if (fetchErr || !therapist) {
      await logError('api.therapists.profile', fetchErr, { stage: 'fetch_therapist', therapist_id: id }, ip, ua);
      return safeJson({ data: null, error: 'Not found' }, { status: 404 });
    }

    const status = (therapist as { status?: string }).status;
    const isPendingOrRejected = status === 'pending_verification' || status === 'rejected';
    const isVerified = status === 'verified';

    // Authorization check:
    // - pending_verification/rejected: open access (onboarding/Rückfrage flow)
    // - verified: requires valid therapist session cookie matching the ID
    if (!isPendingOrRejected) {
      if (!isVerified) {
        return safeJson({ data: null, error: 'Not found' }, { status: 404 });
      }
      // Verify session for verified therapists
      const session = await getTherapistSession(req);
      if (!session || session.therapist_id !== id) {
        return safeJson({ data: null, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const contentType = req.headers.get('content-type') || '';
    let gender: string | undefined;
    let city: string | undefined;
    let acceptingNew: boolean | undefined;
    let profilePhoto: File | undefined;
    // Session fields
    let sessionPreferences: string[] | undefined;
    let typicalRate: number | undefined;
    // Structured address fields
    let practiceStreet: string | undefined;
    let practicePostalCode: string | undefined;
    let practiceCity: string | undefined;
    // Billing address (Rechnungsadresse)
    let billingStreet: string | undefined;
    let billingPostalCode: string | undefined;
    let billingCity: string | undefined;
    // New profile text sections (EARTH-234)
    let whoComesToMe: string | undefined;
    let sessionFocus: string | undefined;
    let firstSession: string | undefined;
    let aboutMe: string | undefined;
    // Schwerpunkte (focus areas)
    let schwerpunkte: string[] | undefined;
    // Languages
    let languages: string[] | undefined;
    // Booking settings
    let requiresIntroBeforeBooking: boolean | undefined;

    // Character limits for profile fields (shared with client config)
    const LIMITS = SERVER_PROFILE_LIMITS;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();

      const parsed = await parseFormData(TherapistProfileUpdate, form);
      if (!parsed.success) {
        const json = await parsed.response
          .json()
          .catch(() => ({} as Record<string, unknown>));
        const msg = typeof json?.error === 'string' ? json.error : 'Invalid request';
        return safeJson(
          { data: null, error: mapProfileContractError(msg) },
          { status: parsed.response.status || 400 }
        );
      }

      const g = form.get('gender');
      const c = form.get('city');
      const a = form.get('accepting_new');
      const pp = form.get('profile_photo');
      const sp = form.get('session_preferences');
      const tr = form.get('typical_rate');
      const pStreet = form.get('practice_street');
      const pPostal = form.get('practice_postal_code');
      const pCity = form.get('practice_city');
      // Billing address fields
      const bStreet = form.get('billing_street');
      const bPostal = form.get('billing_postal_code');
      const bCity = form.get('billing_city');
      // New profile text fields
      const wctm = form.get('who_comes_to_me');
      const sf = form.get('session_focus');
      const fs = form.get('first_session');
      const am = form.get('about_me');
      // Schwerpunkte
      const spkt = form.get('schwerpunkte');
      // Languages
      const lang = form.get('languages');
      // Booking settings
      const rib = form.get('requires_intro_before_booking');

      if (typeof g === 'string' && g.trim()) gender = g.trim();
      if (typeof c === 'string' && c.trim()) city = c.trim();
      if (typeof a === 'string') acceptingNew = a === 'true' || a === '1' || a.toLowerCase() === 'yes';
      if (pp instanceof File && pp.size > 0) profilePhoto = pp as File;
      
      // Parse new profile text fields with length validation
      if (typeof wctm === 'string') {
        const trimmed = wctm.trim();
        if (trimmed.length > LIMITS.who_comes_to_me) {
          return safeJson({ data: null, error: `who_comes_to_me too long (max ${LIMITS.who_comes_to_me} chars)` }, { status: 400 });
        }
        whoComesToMe = trimmed;
      }
      if (typeof sf === 'string') {
        const trimmed = sf.trim();
        if (trimmed.length > LIMITS.session_focus) {
          return safeJson({ data: null, error: `session_focus too long (max ${LIMITS.session_focus} chars)` }, { status: 400 });
        }
        sessionFocus = trimmed;
      }
      if (typeof fs === 'string') {
        const trimmed = fs.trim();
        if (trimmed.length > LIMITS.first_session) {
          return safeJson({ data: null, error: `first_session too long (max ${LIMITS.first_session} chars)` }, { status: 400 });
        }
        firstSession = trimmed;
      }
      if (typeof am === 'string') {
        const trimmed = am.trim();
        if (trimmed.length > LIMITS.about_me) {
          return safeJson({ data: null, error: `about_me too long (max ${LIMITS.about_me} chars)` }, { status: 400 });
        }
        aboutMe = trimmed;
      }
      
      // Parse schwerpunkte (sent as JSON array string)
      if (typeof spkt === 'string' && spkt.trim()) {
        try {
          const parsed = JSON.parse(spkt);
          if (Array.isArray(parsed)) {
            const validIds = parsed.filter((v): v is string => typeof v === 'string' && isValidSchwerpunktId(v));
            if (validIds.length !== parsed.length) {
              return safeJson({ data: null, error: 'Invalid schwerpunkte IDs' }, { status: 400 });
            }
            schwerpunkte = validIds;
          }
        } catch {
          return safeJson({ data: null, error: 'Invalid schwerpunkte format' }, { status: 400 });
        }
      }
      
      // Parse languages (sent as JSON array string)
      if (typeof lang === 'string' && lang.trim()) {
        try {
          const parsed = JSON.parse(lang);
          if (Array.isArray(parsed)) {
            languages = parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
          }
        } catch {
          // Fallback: treat as comma-separated
          languages = lang.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      
      // Parse session_preferences (sent as JSON array string)
      if (typeof sp === 'string' && sp.trim()) {
        try {
          const parsed = JSON.parse(sp);
          if (Array.isArray(parsed)) {
            sessionPreferences = parsed.filter((v): v is string => typeof v === 'string');
          }
        } catch {
          // Fallback: treat as comma-separated
          sessionPreferences = sp.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      if (typeof tr === 'string' && tr.trim()) {
        const rate = parseInt(tr, 10);
        if (!isNaN(rate) && rate > 0) typicalRate = rate;
      }
      if (typeof pStreet === 'string') practiceStreet = pStreet.trim();
      if (typeof pPostal === 'string') practicePostalCode = pPostal.trim();
      if (typeof pCity === 'string') practiceCity = pCity.trim();
      if (typeof bStreet === 'string') billingStreet = bStreet.trim();
      if (typeof bPostal === 'string') billingPostalCode = bPostal.trim();
      if (typeof bCity === 'string') billingCity = bCity.trim();
      // Parse booking settings
      if (typeof rib === 'string') requiresIntroBeforeBooking = rib === 'true' || rib === '1';
    } else {
      // Assume JSON
      const parsed = await parseRequestBody(req, TherapistProfileUpdate);
      if (!parsed.success) {
        const json = await parsed.response
          .json()
          .catch(() => ({} as Record<string, unknown>));
        const msg = typeof json?.error === 'string' ? json.error : 'Invalid request';
        return safeJson(
          { data: null, error: mapProfileContractError(msg) },
          { status: parsed.response.status || 400 }
        );
      }

      const bodyUnknown: unknown = parsed.data;
      const body: Record<string, unknown> =
        bodyUnknown && typeof bodyUnknown === 'object'
          ? (bodyUnknown as Record<string, unknown>)
          : {};

      const g = body['gender'];
      const c = body['city'];
      const a = body['accepting_new'];
      const sp = body['session_preferences'];
      const tr = body['typical_rate'];
      const pStreet = body['practice_street'];
      const pPostal = body['practice_postal_code'];
      const pCity = body['practice_city'];
      // Billing address fields
      const bStreet = body['billing_street'];
      const bPostal = body['billing_postal_code'];
      const bCity = body['billing_city'];
      // New profile text fields
      const wctm = body['who_comes_to_me'];
      const sf = body['session_focus'];
      const fs = body['first_session'];
      const am = body['about_me'];
      // Schwerpunkte
      const spkt = body['schwerpunkte'];
      // Languages
      const lang = body['languages'];
      // Booking settings
      const rib = body['requires_intro_before_booking'];

      if (typeof g === 'string') gender = g;
      if (typeof c === 'string') city = c;
      if (typeof a === 'boolean') acceptingNew = a;
      
      // Parse new profile text fields with length validation (JSON)
      if (typeof wctm === 'string') {
        const trimmed = wctm.trim();
        if (trimmed.length > LIMITS.who_comes_to_me) {
          return safeJson({ data: null, error: `who_comes_to_me too long (max ${LIMITS.who_comes_to_me} chars)` }, { status: 400 });
        }
        whoComesToMe = trimmed;
      }
      if (typeof sf === 'string') {
        const trimmed = sf.trim();
        if (trimmed.length > LIMITS.session_focus) {
          return safeJson({ data: null, error: `session_focus too long (max ${LIMITS.session_focus} chars)` }, { status: 400 });
        }
        sessionFocus = trimmed;
      }
      if (typeof fs === 'string') {
        const trimmed = fs.trim();
        if (trimmed.length > LIMITS.first_session) {
          return safeJson({ data: null, error: `first_session too long (max ${LIMITS.first_session} chars)` }, { status: 400 });
        }
        firstSession = trimmed;
      }
      if (typeof am === 'string') {
        const trimmed = am.trim();
        if (trimmed.length > LIMITS.about_me) {
          return safeJson({ data: null, error: `about_me too long (max ${LIMITS.about_me} chars)` }, { status: 400 });
        }
        aboutMe = trimmed;
      }
      // Parse schwerpunkte (JSON path)
      if (Array.isArray(spkt)) {
        const validIds = spkt.filter((v): v is string => typeof v === 'string' && isValidSchwerpunktId(v));
        if (validIds.length !== spkt.length) {
          return safeJson({ data: null, error: 'Invalid schwerpunkte IDs' }, { status: 400 });
        }
        schwerpunkte = validIds;
      }
      // Parse languages (JSON path)
      if (Array.isArray(lang)) {
        languages = lang.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
      }
      if (Array.isArray(sp)) {
        sessionPreferences = sp.filter((v): v is string => typeof v === 'string');
      }
      if (typeof tr === 'number' && tr > 0) typicalRate = tr;
      if (typeof pStreet === 'string') practiceStreet = pStreet.trim();
      if (typeof pPostal === 'string') practicePostalCode = pPostal.trim();
      if (typeof pCity === 'string') practiceCity = pCity.trim();
      if (typeof bStreet === 'string') billingStreet = bStreet.trim();
      if (typeof bPostal === 'string') billingPostalCode = bPostal.trim();
      if (typeof bCity === 'string') billingCity = bCity.trim();
      // Parse booking settings (JSON)
      if (typeof rib === 'boolean') requiresIntroBeforeBooking = rib;
    }

    // Validate gender if provided
    if (typeof gender === 'string' && !['male', 'female', 'diverse'].includes(gender)) {
      return safeJson({ data: null, error: 'invalid gender' }, { status: 400 });
    }

    // Validate session_preferences if provided
    if (sessionPreferences) {
      const validPrefs = new Set(['online', 'in_person']);
      if (!sessionPreferences.every(p => validPrefs.has(p))) {
        return safeJson({ data: null, error: 'invalid session_preferences' }, { status: 400 });
      }
    }

    // Upload profile photo if provided
    let uploadedPhotoUrl: string | undefined;
    let uploadedProfilePhotoPath: string | undefined;
    
    if (profilePhoto) {
      const valid = isValidPhoto(profilePhoto);
      if (!valid.ok) {
        return safeJson({ data: null, error: `profile_photo: ${valid.reason}` }, { status: 400 });
      }
      const photoExt = getFileExtension(profilePhoto.name || '', profilePhoto.type);
      const buf = await fileToBuffer(profilePhoto);
      
      if (isVerified) {
        // Verified therapists: upload directly to public bucket
        const photoPath = `profiles/${id}/photo-${Date.now()}${photoExt}`;
        const { error: upErr } = await supabaseServer.storage
          .from(PUBLIC_PHOTO_BUCKET)
          .upload(photoPath, buf, { contentType: profilePhoto.type, upsert: true });
        if (upErr) {
          await logError('api.therapists.profile', upErr, { stage: 'upload_profile_photo_public', therapist_id: id, path: photoPath }, ip, ua);
          return safeJson({ data: null, error: 'Failed to upload profile photo' }, { status: 500 });
        }
        // Get public URL
        const { data: urlData } = supabaseServer.storage.from(PUBLIC_PHOTO_BUCKET).getPublicUrl(photoPath);
        uploadedPhotoUrl = urlData?.publicUrl;
      } else {
        // Pending therapists: upload to applications bucket for admin review
        const photoPath = `applications/${id}/profile-photo-${Date.now()}${photoExt}`;
        const { error: upErr } = await supabaseServer.storage
          .from(PENDING_PHOTO_BUCKET)
          .upload(photoPath, buf, { contentType: profilePhoto.type, upsert: false });
        if (upErr) {
          await logError('api.therapists.profile', upErr, { stage: 'upload_profile_photo', therapist_id: id, path: photoPath }, ip, ua);
          return safeJson({ data: null, error: 'Failed to upload profile photo' }, { status: 500 });
        }
        uploadedProfilePhotoPath = photoPath;
      }
    }

    // Prepare metadata merge
    const existingMetaUnknown = (therapist as { metadata?: unknown }).metadata;
    const metaObj: Record<string, unknown> = isObject(existingMetaUnknown) ? (existingMetaUnknown as Record<string, unknown>) : {};
    const profileUnknown = (metaObj as { profile?: unknown }).profile;
    const profile: Record<string, unknown> = isObject(profileUnknown) ? (profileUnknown as Record<string, unknown>) : {};

    // Save new profile text sections
    if (typeof whoComesToMe === 'string') profile.who_comes_to_me = whoComesToMe;
    if (typeof sessionFocus === 'string') profile.session_focus = sessionFocus;
    if (typeof firstSession === 'string') profile.first_session = firstSession;
    if (typeof aboutMe === 'string') profile.about_me = aboutMe;
    
    if (uploadedProfilePhotoPath) profile.photo_pending_path = uploadedProfilePhotoPath;
    // Save structured address fields
    if (typeof practiceStreet === 'string') profile.practice_street = practiceStreet;
    if (typeof practicePostalCode === 'string') profile.practice_postal_code = practicePostalCode;
    if (typeof practiceCity === 'string') profile.practice_city = practiceCity;
    // Also save combined address for backward compatibility (used by slots)
    const combinedAddress = [practiceStreet, practicePostalCode, practiceCity].filter(Boolean).join(', ');
    if (combinedAddress) profile.practice_address = combinedAddress;
    // Save billing address (Rechnungsadresse)
    if (typeof billingStreet === 'string') profile.billing_street = billingStreet;
    if (typeof billingPostalCode === 'string') profile.billing_postal_code = billingPostalCode;
    if (typeof billingCity === 'string') profile.billing_city = billingCity;
    // Combined billing address for convenience
    const combinedBillingAddress = [billingStreet, billingPostalCode, billingCity].filter(Boolean).join(', ');
    if (combinedBillingAddress) profile.billing_address = combinedBillingAddress;
    metaObj.profile = profile;

    // Save booking settings (requires_intro_before_booking)
    if (typeof requiresIntroBeforeBooking === 'boolean') {
      const bookingSettingsUnknown = metaObj.booking_settings;
      const bookingSettings: Record<string, unknown> = isObject(bookingSettingsUnknown)
        ? (bookingSettingsUnknown as Record<string, unknown>)
        : {};
      bookingSettings.requires_intro_before_booking = requiresIntroBeforeBooking;
      metaObj.booking_settings = bookingSettings;
    }

    const updates: Record<string, unknown> = { metadata: metaObj };
    if (typeof gender === 'string') updates.gender = gender;
    if (typeof city === 'string') updates.city = city;
    if (typeof acceptingNew === 'boolean') updates.accepting_new = acceptingNew;
    if (sessionPreferences) updates.session_preferences = sessionPreferences;
    if (schwerpunkte) updates.schwerpunkte = schwerpunkte;
    if (languages) updates.languages = languages;
    if (typeof typicalRate === 'number') updates.typical_rate = typicalRate;
    if (uploadedPhotoUrl) updates.photo_url = uploadedPhotoUrl;

    const { error: updateErr } = await supabaseServer
      .from('therapists')
      .update(updates)
      .eq('id', id);
    if (updateErr) {
      await logError('api.therapists.profile', updateErr, { stage: 'update_metadata', therapist_id: id }, ip, ua);
      return safeJson({ data: null, error: 'Failed to update' }, { status: 500 });
    }

    // Sync practice address to Cal.com if address or session preferences changed
    if (combinedAddress || sessionPreferences) {
      // Get cal_username from therapist record
      const { data: therapistData } = await supabaseServer
        .from('therapists')
        .select('cal_username, session_preferences')
        .eq('id', id)
        .single();
      
      if (therapistData?.cal_username) {
        const prefs = therapistData.session_preferences || [];
        const offersInPerson = Array.isArray(prefs) && prefs.includes('in_person');
        
        // Fire and forget - don't block response on Cal.com sync
        const addressToSync = combinedAddress || (typeof profile.practice_address === 'string' ? profile.practice_address : null);
        void syncPracticeAddressToCal(
          therapistData.cal_username,
          addressToSync,
          offersInPerson
        ).catch(err => {
          console.error('[profile] Cal.com address sync failed:', err);
        });
      }
    }

    void track({ 
      type: 'therapist_profile_updated', 
      level: 'info', 
      source: 'api.therapists.profile', 
      ip, 
      ua, 
      props: { 
        therapist_id: id, 
        is_verified: isVerified,
        fields: { 
          gender: Boolean(gender), 
          city: Boolean(city), 
          accepting_new: typeof acceptingNew === 'boolean', 
          who_comes_to_me: Boolean(whoComesToMe),
          session_focus: Boolean(sessionFocus),
          first_session: Boolean(firstSession),
          about_me: Boolean(aboutMe),
          schwerpunkte: Boolean(schwerpunkte),
          languages: Boolean(languages),
          profile_photo: Boolean(uploadedPhotoUrl || uploadedProfilePhotoPath),
          session_preferences: Boolean(sessionPreferences),
          typical_rate: Boolean(typicalRate),
          practice_street: Boolean(practiceStreet),
          practice_postal_code: Boolean(practicePostalCode),
          practice_city: Boolean(practiceCity),
          billing_street: Boolean(billingStreet),
          billing_postal_code: Boolean(billingPostalCode),
          billing_city: Boolean(billingCity),
          requires_intro_before_booking: typeof requiresIntroBeforeBooking === 'boolean',
        }
      }
    });

    // Response varies based on status
    if (isPendingOrRejected) {
      return safeJson({ data: { ok: true, nextStep: `/therapists/upload-documents/${id}` }, error: null });
    } else {
      return safeJson({ data: { ok: true, photo_url: uploadedPhotoUrl }, error: null });
    }
  } catch (e) {
    await logError('api.therapists.profile', e, { stage: 'exception', therapist_id: id }, ip, ua);
    return safeJson({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
