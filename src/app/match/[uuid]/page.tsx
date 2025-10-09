import { supabaseServer } from '@/lib/supabase-server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Actions } from './Actions';

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

async function getData(uuid: string) {
  const { data: match, error } = await supabaseServer
    .from('matches')
    .select('id, status, created_at, patient_id, therapist_id, metadata')
    .eq('secure_uuid', uuid)
    .single();
  if (error || !match) return null;

  type MatchRow = { 
    id: string; 
    status?: string | null; 
    created_at?: string | null; 
    patient_id: string;
    therapist_id: string;
    metadata?: {
      patient_initiated?: boolean;
      contact_type?: 'booking' | 'consultation';
      patient_reason?: string;
      patient_message?: string;
      contact_method?: 'email' | 'phone';
      session_format?: 'online' | 'in_person';
    } | null;
  };
  const m = match as unknown as MatchRow;

  const { data: patient } = await supabaseServer
    .from('people')
    .select('name, metadata')
    .eq('id', m.patient_id)
    .single();

  type PatientRow = { name?: string | null; metadata?: { city?: string; issue?: string; session_preference?: 'online' | 'in_person'; session_preferences?: ('online' | 'in_person')[]; specializations?: string[]; notes?: string } | null };
  const p = patient as unknown as PatientRow | null;
  const name: string | undefined = typeof p?.name === 'string' && p.name.trim().length > 0 ? p.name : undefined;
  const city: string | undefined = typeof p?.metadata?.city === 'string' ? p.metadata.city : undefined;
  const issue: string | undefined = typeof p?.metadata?.issue === 'string' ? p.metadata.issue : undefined;
  const notes: string | undefined = typeof p?.metadata?.notes === 'string' && p.metadata.notes.trim().length > 0 ? p.metadata.notes.trim() : undefined;
  // Compute a readable session preference label
  const sp = p?.metadata?.session_preference;
  const sps = Array.isArray(p?.metadata?.session_preferences) ? p?.metadata?.session_preferences : [];
  let sessionPreference: string | undefined;
  const toLabel = (v: 'online' | 'in_person') => (v === 'online' ? 'Online' : 'Vor Ort');
  
  // For patient-initiated contacts, check match metadata for session_format
  const matchSessionFormat = m.metadata?.session_format;
  if (matchSessionFormat === 'online' || matchSessionFormat === 'in_person') {
    sessionPreference = toLabel(matchSessionFormat);
  } else if (sps && sps.length > 0) {
    const set = new Set(sps);
    if (set.has('online') && set.has('in_person')) sessionPreference = 'Online oder Vor Ort';
    else if (set.has('online')) sessionPreference = toLabel('online');
    else if (set.has('in_person')) sessionPreference = toLabel('in_person');
  } else if (sp === 'online' || sp === 'in_person') {
    sessionPreference = toLabel(sp);
  }

  const age = hoursSince(m.created_at ?? undefined);
  const expired = age == null || age > 72;
  const expiresInHours = age == null ? null : Math.max(0, Math.ceil(72 - age));

  // Requested specializations (slugs -> human labels)
  const slugToLabel: Record<string, string> = {
    narm: 'NARM',
    hakomi: 'Hakomi',
    'somatic-experiencing': 'Somatic Experiencing',
    'core-energetics': 'Core Energetics',
  };
  const specializations: string[] = Array.isArray(p?.metadata?.specializations)
    ? p!.metadata!.specializations!.map((s) => slugToLabel[String(s)] || String(s))
    : [];

  const currentStatus = String(m.status || 'proposed').toLowerCase();

  // Extract patient-initiated contact metadata (EARTH-205)
  const contactType = m.metadata?.contact_type as 'booking' | 'consultation' | undefined;
  const patientMessage = typeof m.metadata?.patient_message === 'string' ? m.metadata.patient_message : undefined;
  const patientReason = typeof m.metadata?.patient_reason === 'string' ? m.metadata.patient_reason : undefined;
  const contactMethod = m.metadata?.contact_method as 'email' | 'phone' | undefined;

  // Fetch therapist name (EARTH-205: needed for mailto signature)
  let therapistName: string | null = null;
  try {
    const { data: therapist } = await supabaseServer
      .from('therapists')
      .select('first_name, last_name')
      .eq('id', m.therapist_id)
      .single();
    if (therapist) {
      type TherapistRow = { first_name?: string | null; last_name?: string | null };
      const t = therapist as unknown as TherapistRow;
      const parts = [t.first_name || '', t.last_name || ''].filter(Boolean);
      therapistName = parts.length > 0 ? parts.join(' ') : null;
    }
  } catch {}

  // Only fetch contact details if already accepted (avoid exposing PII prematurely)
  let contact: { name?: string | null; email?: string | null; phone?: string | null } | null = null;
  if (currentStatus === 'accepted') {
    try {
      const { data: patientContact } = await supabaseServer
        .from('people')
        .select('name, email, phone')
        .eq('id', m.patient_id)
        .single();
      type PatientContactRow = { name?: string | null; email?: string | null; phone?: string | null };
      const pc = (patientContact as unknown) as PatientContactRow | null;
      if (pc) {
        contact = {
          name: pc.name ?? null,
          email: pc.email ?? null,
          phone: pc.phone ?? null,
        };
      }
    } catch {}
  }

  return {
    id: m.id,
    status: currentStatus,
    name,
    city,
    issue,
    sessionPreference,
    expired,
    expiresInHours,
    specializations,
    notes,
    contact,
    // EARTH-205: Patient-initiated contact fields
    contactType,
    patientMessage,
    patientReason,
    contactMethod,
    createdAt: m.created_at,
    therapistName,
  } as const;
}

export default async function Page({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid: rawUuid } = await params;
  const uuid = (rawUuid || '').trim();
  if (!uuid) return null;
  const data = await getData(uuid);

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Anfrage nicht gefunden</CardTitle>
            <CardDescription>
              Der Link ist ungültig oder wurde bereits verwendet.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const subtitleParts = [data.city, data.issue].filter(Boolean);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Neue Klientenanfrage</CardTitle>
          {subtitleParts.length ? (
            <CardDescription>{subtitleParts.join(' · ')}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {/* EARTH-205: Show request type and timestamp */}
            {data.contactType || data.createdAt ? (
              <div className="flex items-center justify-between text-sm">
                {data.contactType ? (
                  <span className="font-medium text-emerald-700">
                    {data.contactType === 'booking' ? 'Direktbuchung' : 'Kostenloses Erstgespräch (15 Min)'}
                  </span>
                ) : null}
                {data.createdAt ? (
                  <span className="text-muted-foreground">
                    Angefragt vor {Math.round(hoursSince(data.createdAt) || 0)} Stunden
                  </span>
                ) : null}
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {data.expiresInHours != null && !data.expired
                ? `Noch ${data.expiresInHours < 1 ? '<1' : data.expiresInHours} Stunden gültig`
                : 'Du kannst diese Anfrage innerhalb von 72 Stunden beantworten.'}
            </p>
            <div className="space-y-1 text-sm">
              {data.name ? (
                <p>
                  <span className="text-muted-foreground">Klient:in:</span> {data.name}
                </p>
              ) : null}
              {data.sessionPreference ? (
                <p>
                  <span className="text-muted-foreground">Sitzungspräferenz:</span> {data.sessionPreference}
                </p>
              ) : null}
              {data.specializations && data.specializations.length > 0 ? (
                <p>
                  <span className="text-muted-foreground">Bevorzugte Methoden:</span> {data.specializations.join(', ')}
                </p>
              ) : null}
              {data.notes ? (
                <p>
                  <span className="text-muted-foreground">Anliegen:</span> {data.notes}
                </p>
              ) : null}
            </div>
            {/* EARTH-205: Display patient message */}
            {data.patientMessage ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-900 mb-2">Nachricht vom Klienten</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.patientMessage}</p>
              </div>
            ) : null}
            {!data.expired ? (
              <p className="text-xs text-muted-foreground">
                Nach Annahme erhältst du die Kontaktdaten zur direkten Kontaktaufnahme.
              </p>
            ) : null}
            <Actions
              uuid={uuid}
              matchId={data.id}
              expired={data.expired}
              initialStatus={data.status}
              initialContact={data.contact || undefined}
              contactType={data.contactType}
              patientName={data.name}
              patientReason={data.patientReason}
              contactMethod={data.contactMethod}
              therapistName={data.therapistName || undefined}
              sessionPreference={data.sessionPreference}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

