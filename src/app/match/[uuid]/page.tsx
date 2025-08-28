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
    .select('id, status, created_at, patient_id')
    .eq('secure_uuid', uuid)
    .single();
  if (error || !match) return null;

  type MatchRow = { id: string; status?: string | null; created_at?: string | null; patient_id: string };
  const m = match as unknown as MatchRow;

  const { data: patient } = await supabaseServer
    .from('people')
    .select('metadata')
    .eq('id', m.patient_id)
    .single();

  type PatientRow = { metadata?: { city?: string; issue?: string } | null };
  const p = patient as unknown as PatientRow | null;
  const city: string | undefined = typeof p?.metadata?.city === 'string' ? p.metadata.city : undefined;
  const issue: string | undefined = typeof p?.metadata?.issue === 'string' ? p.metadata.issue : undefined;

  const age = hoursSince(m.created_at ?? undefined);
  const expired = age == null || age > 72;

  return {
    id: m.id,
    status: String(m.status || 'proposed').toLowerCase(),
    city,
    issue,
    expired,
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
          <CardTitle>Neue Patientenanfrage</CardTitle>
          {subtitleParts.length ? (
            <CardDescription>{subtitleParts.join(' · ')}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Sie können diese Anfrage innerhalb von 72 Stunden beantworten.
            </p>
            <Actions
              uuid={uuid}
              matchId={data.id}
              expired={data.expired}
              initialStatus={data.status}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
