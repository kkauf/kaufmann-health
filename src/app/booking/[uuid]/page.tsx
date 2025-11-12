import { supabaseServer } from '@/lib/supabase-server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import { track } from '@/lib/logger';

function formatDate(d: string): string {
  try {
    const [y, m, day] = d.split('-');
    return `${day}.${m}.${y}`;
  } catch {
    return d;
  }
}

async function getData(uuid: string) {
  const { data: booking } = await supabaseServer
    .from('bookings')
    .select('id, patient_id, therapist_id, date_iso, time_label, format')
    .eq('secure_uuid', uuid)
    .maybeSingle();
  if (!booking) return null;

  type BookingRow = { id: string; patient_id: string; therapist_id: string; date_iso: string; time_label: string; format: 'online' | 'in_person' };
  const b = booking as unknown as BookingRow;

  // Resolve address for in-person from slot or fallback to practice address
  let address: string | undefined;
  if (b.format === 'in_person') {
    try {
      const { data: slots } = await supabaseServer
        .from('therapist_slots')
        .select('time_local, format, address, active')
        .eq('therapist_id', b.therapist_id)
        .eq('active', true);
      if (Array.isArray(slots)) {
        const m = (slots as { time_local: string | null; format: string; address?: string | null }[])
          .find((s) => String(s.time_local || '').slice(0, 5) === b.time_label && s.format === 'in_person');
        address = (m?.address || '').trim() || undefined;
      }
      if (!address) {
        const { data: t } = await supabaseServer
          .from('therapists')
          .select('metadata')
          .eq('id', b.therapist_id)
          .maybeSingle();
        try {
          const md = (t as unknown as { metadata?: Record<string, unknown> } | null)?.metadata || {};
          const prof = md['profile'] as Record<string, unknown> | undefined;
          const pa = typeof prof?.['practice_address'] === 'string' ? (prof['practice_address'] as string) : '';
          address = pa.trim() || undefined;
        } catch {}
      }
    } catch {}
  }

  // Patient contact details (PII only on this secured page)
  let patient: { name?: string | null; email?: string | null; phone?: string | null } = {};
  try {
    const { data: p } = await supabaseServer
      .from('people')
      .select('name, email, phone_number')
      .eq('id', b.patient_id)
      .maybeSingle();
    const pr = (p as unknown) as { name?: string | null; email?: string | null; phone_number?: string | null } | null;
    if (pr) {
      patient = { name: pr.name || null, email: pr.email || null, phone: pr.phone_number || null };
    }
  } catch {}

  // Attempt to persist therapist_viewed_at
  try {
    await supabaseServer
      .from('bookings')
      .update({ therapist_viewed_at: new Date().toISOString() as unknown as string })
      .eq('id', b.id);
  } catch {}

  // Track event (best-effort)
  try {
    await track({ type: 'booking_therapist_viewed', level: 'info', source: 'booking.page', props: { booking_id: b.id, therapist_id: b.therapist_id } });
  } catch {}

  return {
    id: b.id,
    therapist_id: b.therapist_id,
    patient,
    dateIso: b.date_iso,
    timeLabel: b.time_label,
    format: b.format,
    address,
  } as const;
}

export default async function Page({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid: rawUuid } = await params;
  const uuid = (rawUuid || '').trim();
  if (!uuid) return null;
  const data = await getData(uuid);

  if (!data) {
    return (
      <>
        <div className="mx-auto max-w-xl px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Buchung nicht gefunden</CardTitle>
              <CardDescription>
                Der Link ist ungültig oder wurde bereits verwendet.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <FloatingWhatsApp />
      </>
    );
  }

  const dateLabel = `${formatDate(data.dateIso)}, ${data.timeLabel} Uhr`;

  return (
    <>
      <div className="mx-auto max-w-xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Buchungsdetails</CardTitle>
            <CardDescription>{dateLabel} · {data.format === 'online' ? 'Online' : 'Vor Ort'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {data.address && (
                <p className="text-sm"><span className="text-muted-foreground">Adresse:</span> {data.address}</p>
              )}
              <div className="space-y-1 text-sm">
                {data.patient.name ? (
                  <p><span className="text-muted-foreground">Klient:in:</span> {data.patient.name}</p>
                ) : null}
                {data.patient.email ? (
                  <p><span className="text-muted-foreground">E‑Mail:</span> {data.patient.email}</p>
                ) : null}
                {data.patient.phone ? (
                  <p><span className="text-muted-foreground">Telefon:</span> {data.patient.phone}</p>
                ) : null}
              </div>
              {data.format === 'online' ? (
                <p className="text-xs text-muted-foreground">Hinweis: Bitte sende den Zugangs‑Link rechtzeitig an die Klient:in.</p>
              ) : null}
              <p className="text-xs text-muted-foreground">Falls der Termin nicht möglich ist, antworte bitte auf diese E‑Mail, damit wir eine Lösung finden.</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <FloatingWhatsApp />
    </>
  );
}
