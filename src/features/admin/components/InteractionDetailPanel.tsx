"use client";

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string | null;
  patientName: string | null;
  patientEmail: string | null;
};

type Booking = {
  id: string;
  kind: string;
  start_time: string;
  end_time: string | null;
  status: string;
};

type TherapistEntry = {
  therapist: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
  };
  match_status: string;
  match_created_at: string;
  has_bookings: boolean;
  bookings: Booking[];
};

type EmailEntry = {
  type: string;
  kind: string | null;
  subject: string | null;
  created_at: string;
};

type DetailData = {
  therapists: TherapistEntry[];
  emails: EmailEntry[];
  resend_link: string | null;
};

const MATCH_STATUS_STYLES: Record<string, string> = {
  proposed: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  therapist_contacted: 'bg-blue-100 text-blue-800 border-blue-200',
  therapist_responded: 'bg-blue-100 text-blue-800 border-blue-200',
  session_booked: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completed: 'bg-slate-100 text-slate-800 border-slate-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE');
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function InteractionDetailPanel({
  open,
  onOpenChange,
  patientId,
  patientName,
  patientEmail,
}: Props) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !patientId) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/interactions/${patientId}`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json.data);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, patientId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{patientName ?? 'Patient:in'}</SheetTitle>
          {patientEmail && (
            <SheetDescription>{patientEmail}</SheetDescription>
          )}
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Laden...
          </div>
        )}

        {!loading && data && (
          <Tabs defaultValue="therapists" className="px-4 pb-4">
            <TabsList>
              <TabsTrigger value="therapists">Therapeut:innen</TabsTrigger>
              <TabsTrigger value="emails">E-Mails</TabsTrigger>
            </TabsList>

            <TabsContent value="therapists" className="mt-4 space-y-0">
              {data.therapists.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Zuweisungen</p>
              )}
              {data.therapists.map((entry, i) => (
                <div
                  key={entry.therapist.id}
                  className={`py-3 space-y-2 ${i < data.therapists.length - 1 ? 'border-b' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{entry.therapist.name}</p>
                      {entry.therapist.city && (
                        <p className="text-xs text-muted-foreground">{entry.therapist.city}</p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={MATCH_STATUS_STYLES[entry.match_status] ?? ''}
                    >
                      {entry.match_status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {entry.therapist.email && (
                      <a href={`mailto:${entry.therapist.email}`} className="underline">
                        {entry.therapist.email}
                      </a>
                    )}
                    {entry.therapist.phone && (
                      <a href={`tel:${entry.therapist.phone}`} className="underline">
                        {entry.therapist.phone}
                      </a>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Zugewiesen am {formatDate(entry.match_created_at)}
                  </p>

                  {entry.has_bookings ? (
                    <div className="space-y-1.5 pl-2">
                      {entry.bookings.map((b) => (
                        <div key={b.id} className="flex items-center gap-2 text-xs">
                          <Badge
                            variant="outline"
                            className={
                              b.kind === 'intro'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }
                          >
                            {b.kind === 'intro' ? 'Intro' : 'Sitzung'}
                          </Badge>
                          <span>{formatDate(b.start_time)}</span>
                          <span className="text-muted-foreground">{b.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Keine Buchung — Messaging-Kontakt
                    </p>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="emails" className="mt-4 space-y-3">
              {data.resend_link && (
                <a
                  href={data.resend_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  In Resend öffnen →
                </a>
              )}

              {data.emails.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine E-Mails gefunden</p>
              )}

              {data.emails.map((email, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    {formatDateTime(email.created_at)}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      email.type === 'email_bounced'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }
                  >
                    {email.type === 'email_bounced' ? 'Bounced' : 'Gesendet'}
                  </Badge>
                  {email.kind && (
                    <Badge variant="secondary" className="text-[10px]">{email.kind}</Badge>
                  )}
                  {email.subject && (
                    <span className="text-muted-foreground truncate">{email.subject}</span>
                  )}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
